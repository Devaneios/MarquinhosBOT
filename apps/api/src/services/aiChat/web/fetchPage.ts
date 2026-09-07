// The only place in the codebase that reaches out to arbitrary hosts, and it
// deliberately runs in the API process instead of the agent sandbox: the
// container stays on NetworkMode "none", so arbitrary code the model writes can
// never reach out on its own.
//
// Accepted risk: hostnames are resolved and screened before the request, but the
// request itself goes out by hostname, leaving a DNS-rebinding window between the
// two. Closing it would mean connecting to the validated IP with a manual Host
// header; that is disproportionate here, and it is the same pragmatic tradeoff
// already accepted for mounting docker.sock.
import * as cheerio from 'cheerio';
import { lookup as dnsLookup } from 'node:dns/promises';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export const MAX_REDIRECTS = 3;
// 512 KB used to be the cap, and it silently destroyed exactly the pages worth
// reading: a class reference or a gov portal spends more than that on nav and
// inline script before the article starts, so the cap landed inside markup that
// the noise filter then removed, leaving an empty string.
export const MAX_BODY_BYTES = 4 * 1024 * 1024;
export const MAX_LINKS = 150;
export const FETCH_TIMEOUT_MS = 8000;
const MAX_LABEL_CHARS = 80;
const MAX_TITLE_CHARS = 200;
const USER_AGENT = 'MarquinhosBOT/1.0 (Discord bot; agent tool)';
const ALLOWED_CONTENT_TYPES = [
  'text/html',
  'text/plain',
  'application/json',
  'application/xhtml+xml',
  'application/pdf',
];

/**
 * Text extraction runs in this process with no worker, so it is CPU the API
 * cannot serve requests during. A 48-page report costs ~8s; capping pages keeps
 * a 500-page document from freezing everything, and the callers slice the text
 * down to a fraction of this anyway.
 */
export const MAX_PDF_PAGES = 20;

interface LookupResult {
  address: string;
  family: number;
}

export type LookupFn = (
  hostname: string,
  options: { all: true },
) => Promise<LookupResult[]>;

export type FetchFn = (
  input: URL | string,
  init?: RequestInit,
) => Promise<Response>;

export interface PdfText {
  text: string;
  /** Title from the document metadata, empty when the pdf carries none. */
  title: string;
}

export type PdfTextExtractor = (bytes: Uint8Array) => Promise<PdfText>;

export interface FetchPageDeps {
  fetchFn: FetchFn;
  lookupFn: LookupFn;
  extractPdfText?: PdfTextExtractor;
}

/**
 * Pulls text out of a pdf, first `MAX_PDF_PAGES` pages only.
 *
 * unpdf is imported on demand because it bundles pdf.js: loading it costs real
 * startup time, and most of this process never touches a pdf. Note that pdf.js
 * detaches the buffer it is handed, so `bytes` must not be read afterwards.
 */
async function extractPdfTextWithUnpdf(bytes: Uint8Array): Promise<PdfText> {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(bytes);

  let title = '';
  try {
    const metadata = await pdf.getMetadata();
    const raw = (metadata.info as { Title?: unknown } | undefined)?.Title;
    if (typeof raw === 'string') title = raw.trim();
  } catch {
    // Metadata is a nicety; the search hit's title already covers us.
  }

  const pages: string[] = [];
  const limit = Math.min(pdf.numPages, MAX_PDF_PAGES);
  for (let pageNumber = 1; pageNumber <= limit; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
  }

  return { text: pages.filter(Boolean).join('\n\n'), title };
}

export type FetchPageMode = 'text' | 'links';

export interface FetchPageOptions {
  mode?: FetchPageMode;
  timeoutMs?: number;
}

export interface FetchedPage {
  /** URL actually served, after any redirect hops. */
  finalUrl: string;
  contentType: string;
  isHtml: boolean;
  /** True when the response body hit MAX_BODY_BYTES and was cut short. */
  truncated: boolean;
  title: string;
  /** Markdown for HTML, raw text otherwise. Empty in "links" mode. */
  content: string;
  /** "label → url" entries, same host only. Empty in "text" mode. */
  links: string[];
}

/**
 * Every rejection a caller is expected to surface to a user or a model — a
 * blocked host, a bad status, an unreadable content type. Distinct from a
 * genuine crash so callers can pass the message straight through.
 */
export class FetchPageError extends Error {}

function fail(message: string): never {
  throw new FetchPageError(message);
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }
  const a = parts[0] ?? -1;
  const b = parts[1] ?? -1;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && (b === 0 || b === 168)) return true;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return true;
  if (a === 203 && b === 0) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIpv6(address: string): boolean {
  const addr = address.toLowerCase().split('%')[0] ?? '';
  if (addr === '::' || addr === '::1') return true;
  const mapped = addr.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isBlockedIpv4(mapped[1] ?? '');
  const head = addr.split(':')[0];
  if (!head) return true;
  const group = Number.parseInt(head, 16);
  if (Number.isNaN(group)) return true;
  if ((group & 0xfe00) === 0xfc00) return true;
  if ((group & 0xffc0) === 0xfe80) return true;
  if ((group & 0xff00) === 0xff00) return true;
  return false;
}

function isBlockedAddress({ address, family }: LookupResult): boolean {
  return family === 6 ? isBlockedIpv6(address) : isBlockedIpv4(address);
}

export async function assertUrlIsSafe(
  rawUrl: string,
  lookupFn: LookupFn,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    fail(`URL inválida: "${rawUrl}".`);
  }

  if (url.protocol !== 'https:') {
    fail(
      `Só consigo buscar URLs https. "${url.protocol}" não é permitido (recebi "${rawUrl}").`,
    );
  }

  let addresses: LookupResult[];
  try {
    addresses = await lookupFn(url.hostname, { all: true });
  } catch (error) {
    fail(
      `Não consegui resolver o host "${url.hostname}": ${(error as Error).message}.`,
    );
  }

  if (addresses.length === 0) {
    fail(`Não consegui resolver o host "${url.hostname}".`);
  }

  const blocked = addresses.find(isBlockedAddress);
  if (blocked) {
    fail(
      `Recusei "${url.hostname}": aponta para um endereço interno (${blocked.address}). Só busco hosts públicos.`,
    );
  }

  return url;
}

/**
 * Reads at most `MAX_BODY_BYTES`, keeping the raw bytes: a pdf decoded as text
 * is destroyed, so the decision of how to interpret the body belongs to the
 * caller that knows the content type.
 */
async function readCappedBody(
  response: Response,
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (!response.body) return { bytes: new Uint8Array(), truncated: false };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    const remaining = MAX_BODY_BYTES - total;
    if (value.byteLength >= remaining) {
      chunks.push(value.slice(0, remaining));
      total += remaining;
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }

    chunks.push(value);
    total += value.byteLength;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncated };
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  linkStyle: 'inlined',
  emDelimiter: '_',
}).use(gfm);

interface TurndownNode {
  nodeName: string;
  firstChild: TurndownNode | null;
  textContent: string | null;
  getAttribute(name: string): string | null;
}

// Turndown's built-in <pre><code> rule fences the block but drops any
// language-xxx/lang-xxx class hint, which matters when the reader is a
// coding-context bot.
turndownService.addRule('fencedCodeLanguage', {
  filter: (node) =>
    node.nodeName === 'PRE' && node.firstChild?.nodeName === 'CODE',
  replacement: (_content, node) => {
    const codeEl = (node as unknown as TurndownNode).firstChild;
    const className = codeEl?.getAttribute('class') ?? '';
    const lang = /(?:language|lang)-(\S+)/.exec(className)?.[1] ?? '';
    return `\n\n\`\`\`${lang}\n${codeEl?.textContent}\n\`\`\`\n\n`;
  },
});

const NOISE_SELECTOR =
  'script, style, noscript, template, head, iframe, svg, form, nav, header, footer, aside';

function htmlToMarkdown(html: string, base: URL): string {
  const $ = cheerio.load(html);
  $(NOISE_SELECTOR).remove();
  $('img').remove();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      $(el).attr('href', new URL(href, base).toString());
    } catch {
      $(el).removeAttr('href');
    }
  });
  const bodyHtml = $('body').html() ?? $.html();
  return turndownService.turndown(bodyHtml).trim();
}

function extractTitle(html: string): string {
  const $ = cheerio.load(html);
  const candidates = [
    $('head > title').first().text(),
    $('meta[property="og:title"]').attr('content') ?? '',
    $('h1').first().text(),
  ];
  const title = candidates.find((value) => value.trim().length > 0) ?? '';
  return title.trim().replace(/\s+/g, ' ').slice(0, MAX_TITLE_CHARS);
}

function extractLinks(html: string, base: URL): string[] {
  const $ = cheerio.load(html);
  const found = new Map<string, string>();
  const self = new URL(base.toString());
  self.hash = '';
  const selfKey = self.toString();

  $('a[href]').each((_, el) => {
    if (found.size >= MAX_LINKS) return false;
    const href = $(el).attr('href');
    if (!href) return;
    let target: URL;
    try {
      target = new URL(href, base);
    } catch {
      return;
    }
    if (target.protocol !== 'https:' && target.protocol !== 'http:') return;
    if (target.hostname !== base.hostname) return;

    target.hash = '';
    const key = target.toString();
    // In-page anchors collapse to the page itself once the fragment is gone;
    // offering the current page as a hop only invites the model to loop.
    if (key === selfKey || found.has(key)) return;

    found.set(
      key,
      $(el).text().trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL_CHARS),
    );
    return;
  });

  return [...found].map(([url, label]) => (label ? `${label} → ${url}` : url));
}

export type PageFetcher = (
  rawUrl: string,
  options?: FetchPageOptions,
) => Promise<FetchedPage>;

/**
 * Fetches one public https page and returns it as markdown (or its same-host
 * links). Failures a caller should report verbatim come back as
 * {@link FetchPageError}; everything else is a real bug and propagates.
 */
export function createPageFetcher(
  deps: Partial<FetchPageDeps> = {},
): PageFetcher {
  const fetchFn = deps.fetchFn ?? fetch;
  const lookupFn = deps.lookupFn ?? (dnsLookup as unknown as LookupFn);
  const extractPdfText = deps.extractPdfText ?? extractPdfTextWithUnpdf;

  return async function fetchPage(
    rawUrl: string,
    options: FetchPageOptions = {},
  ): Promise<FetchedPage> {
    const mode = options.mode ?? 'text';
    const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;

    let current = await assertUrlIsSafe(rawUrl, lookupFn);

    for (let hop = 0; ; hop++) {
      let response: Response;
      try {
        response = await fetchFn(current, {
          method: 'GET',
          redirect: 'manual',
          credentials: 'omit',
          headers: {
            'user-agent': USER_AGENT,
            // Stating a preference without refusing the rest: an Accept of
            // "text/html,text/plain" makes servers that negotiate content
            // answer 406 rather than serve the page (nvlpubs.nist.gov does).
            accept:
              'text/html,application/xhtml+xml,text/plain;q=0.9,application/json;q=0.8,*/*;q=0.7',
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if ((error as Error).name === 'TimeoutError') {
          fail(
            `"${rawUrl}" demorou mais de ${timeoutMs / 1000}s e eu desisti.`,
          );
        }
        fail(`Não consegui buscar "${rawUrl}": ${(error as Error).message}`);
      }

      if (response.status >= 300 && response.status < 400) {
        if (hop >= MAX_REDIRECTS) {
          fail(`Desisti de "${rawUrl}": mais de ${MAX_REDIRECTS} redirects.`);
        }
        const location = response.headers.get('location');
        if (!location) {
          fail(
            `"${current.toString()}" respondeu ${response.status} (redirect) sem header location.`,
          );
        }
        current = await assertUrlIsSafe(
          new URL(location, current).toString(),
          lookupFn,
        );
        continue;
      }

      if (!response.ok) {
        fail(
          `"${current.toString()}" respondeu ${response.status} ${response.statusText}.`,
        );
      }

      const contentType = (
        response.headers.get('content-type') ?? ''
      ).toLowerCase();
      const allowed = ALLOWED_CONTENT_TYPES.some((type) =>
        contentType.includes(type),
      );
      if (!allowed) {
        fail(
          `Não sei ler "${contentType || 'conteúdo sem content-type'}" — só HTML, texto e JSON.`,
        );
      }

      const { bytes, truncated } = await readCappedBody(response);
      const isHtml =
        contentType.includes('html') || contentType.includes('xhtml');
      const isPdf = contentType.includes('pdf');

      if (isPdf) {
        if (mode === 'links') {
          fail(
            `"${current.toString()}" é um PDF, então não tem links para extrair.`,
          );
        }
        // A pdf keeps its cross-reference table at the end of the file, so a
        // body we cut short is not a shorter pdf — it is an unparseable one.
        if (truncated) {
          fail(
            `"${current.toString()}" é um PDF maior que ${Math.round(
              MAX_BODY_BYTES / 1024,
            )}KB e um PDF cortado não abre.`,
          );
        }

        let pdf: PdfText;
        try {
          pdf = await extractPdfText(bytes);
        } catch (error) {
          fail(
            `Não consegui ler o PDF "${current.toString()}": ${(error as Error).message}`,
          );
        }
        if (!pdf.text.trim()) {
          fail(
            `O PDF "${current.toString()}" não tem texto extraível — provavelmente é digitalizado como imagem.`,
          );
        }

        return {
          finalUrl: current.toString(),
          contentType,
          isHtml: false,
          truncated,
          title: pdf.title,
          content: pdf.text,
          links: [],
        };
      }

      const text = new TextDecoder().decode(bytes);

      if (mode === 'links' && !isHtml) {
        fail(
          `"${current.toString()}" não é HTML (${contentType}), então não tem links para extrair.`,
        );
      }

      const content =
        mode === 'links'
          ? ''
          : isHtml
            ? htmlToMarkdown(text, current)
            : text.trim();

      // An empty result on a body we cut short is a page we failed to read, not
      // a page with nothing on it. Saying so is what lets the caller log it and
      // the user see it, instead of the source vanishing.
      if (mode === 'text' && truncated && !content) {
        fail(
          `"${current.toString()}" é grande demais: o corpo passou de ${Math.round(
            MAX_BODY_BYTES / 1024,
          )}KB e foi cortado antes de qualquer conteúdo legível.`,
        );
      }

      return {
        finalUrl: current.toString(),
        contentType,
        isHtml,
        truncated,
        title: isHtml ? extractTitle(text) : '',
        content,
        links: mode === 'links' ? extractLinks(text, current) : [],
      };
    }
  };
}

export const fetchPage = createPageFetcher();
