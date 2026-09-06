import { NOOP_TRACE, type TraceContext } from 'services/aiChat/AiTraceRecorder';
import { ResponsesClient } from 'services/aiChat/llm/ResponsesClient';
import type {
  ResearchSource,
  ResearchStats,
} from 'services/aiChat/research/ResearchJobStore';
import {
  buildAnalysisInput,
  buildExtractionInput,
  buildPlanInput,
  buildReflectionInput,
  buildSynthesisInput,
  buildTriageInput,
  reflectionSchema,
  RESEARCH_ANALYSIS_PROMPT,
  RESEARCH_PLAN_PROMPT,
  RESEARCH_REFLECTION_PROMPT,
  RESEARCH_SYNTHESIS_PROMPT,
  RESEARCH_TRIAGE_PROMPT,
  researchAnalysisSchema,
  researchPlanSchema,
  SOURCE_EXTRACTION_PROMPT,
  sourceExtractionSchema,
  triageSchema,
  type NumberedExtraction,
  type ResearchAnalysis,
  type ResearchPlan,
} from 'services/aiChat/research/researchPrompts';
import {
  normalizeUrl,
  rankHits,
  type RankedHit,
} from 'services/aiChat/research/sourceRanking';
import {
  createPageFetcher,
  FetchPageError,
  type PageFetcher,
} from 'services/aiChat/web/fetchPage';
import {
  SearxngClient,
  type SearchHit,
} from 'services/aiChat/web/SearxngClient';
import { logger } from 'utils/logger';

export const MAX_ROUNDS = Number(process.env.AI_RESEARCH_MAX_ROUNDS ?? 5);
export const MAX_SEARCHES = Number(process.env.AI_RESEARCH_MAX_SEARCHES ?? 30);
export const MAX_FETCHES = Number(process.env.AI_RESEARCH_MAX_FETCHES ?? 40);
export const RESEARCH_DEADLINE_MS = Number(
  process.env.AI_RESEARCH_DEADLINE_MS ?? 900_000,
);

/** How far a chain of follow-ups may get from the queries the plan wrote. */
export const MAX_FRONTIER_DEPTH = 3;
/**
 * The evidence bar the reflection step cannot talk its way out of. Left to
 * itself the auditor calls the material sufficient on the first round, which is
 * exactly the shallow report this pipeline exists to avoid.
 */
export const MIN_ROUNDS = 2;
export const MIN_RELEVANT_SOURCES = 12;
export const MIN_SOURCES_PER_FACET = 2;

const SEARCH_CONCURRENCY = 8;
const FETCH_CONCURRENCY = 8;
const QUERIES_PER_ROUND = 8;
const HITS_PER_QUERY = 12;
const TRIAGE_POOL = 40;
const SOURCES_PER_ROUND = 10;
const MAX_PER_DOMAIN = 3;
const SOURCE_CONTENT_CHARS = 20_000;
const SOURCE_FETCH_TIMEOUT_MS = 12_000;
/** Time held back so analysis and writing always happen, deadline or not. */
const SYNTHESIS_RESERVE_MS = 180_000;
// Ceilings, not budgets: reasoning tokens are billed against max_output_tokens,
// so a high-effort call can spend a tight cap entirely on thinking and return
// nothing. Generous caps cost nothing on calls that do not need them.
const PLAN_MAX_TOKENS = 12_000;
const TRIAGE_MAX_TOKENS = 6000;
const EXTRACTION_MAX_TOKENS = 12_000;
const REFLECTION_MAX_TOKENS = 8000;
const ANALYSIS_MAX_TOKENS = 16_000;
const SYNTHESIS_MAX_TOKENS = 20_000;

const PLAN_EFFORT = 'high';
const TRIAGE_EFFORT = 'low';
const EXTRACTION_EFFORT = 'high';
const REFLECTION_EFFORT = 'medium';
const ANALYSIS_EFFORT = 'high';
const SYNTHESIS_EFFORT = 'high';

export type ProgressReporter = (stage: string, message: string) => void;

export interface DeepResearchRequest {
  query: string;
  trace?: TraceContext;
  onProgress?: ProgressReporter;
}

export interface DeepResearchResult {
  report: string;
  sources: ResearchSource[];
  stats: ResearchStats;
}

type QueryOrigin = 'plan' | 'source' | 'reflection';

/** Why a selected page produced no source, so the thread can say it out loud. */
type ReadOutcome =
  | { ok: true; source: Omit<NumberedExtraction, 'index'> }
  | { ok: false; url: string; reason: string };

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

interface FrontierEntry {
  query: string;
  depth: number;
  origin: QueryOrigin;
}

/** Runs `worker` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await worker(items[index]!);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

/** Terms per query above which SearXNG's AND semantics start matching nothing. */
const MAX_QUERY_TERMS = 6;
/** File types the reader cannot parse. PDF is absent on purpose: it reads those. */
const UNREADABLE_EXTENSIONS =
  /\.(docx?|pptx?|xlsx?|zip|rar|tar|gz|epub|mp[34]|avi|mkv)($|\?)/i;

/**
 * Removes engine operators the models keep inventing. SearXNG passes them
 * through to engines that mostly ignore them, so a query carrying `site:` comes
 * back either empty or full of results that match nothing but the operator.
 *
 * Quotes get the same treatment for a harsher reason: the engines honour them,
 * so a follow-up phrased as `"Semi-Adjusting BSP-tree" 4250 moving objects`
 * asks for an exact phrase plus four more terms and reliably finds nothing.
 */
export function sanitizeQuery(query: string): string {
  return (
    query
      .replace(/https?:\/\/\S+/gi, ' ')
      .replace(
        /\b(?:site|filetype|ext|inurl|intitle|intext|related):\S+/gi,
        ' ',
      )
      .replace(/\b(?:OR|AND)\b/g, ' ')
      .replace(/["«»“”()[\]{}]/g, ' ')
      // Only the quoting apostrophes, so "Godot's" survives intact.
      .replace(/(?<![\p{L}\p{N}])['‘’]|['‘’](?![\p{L}\p{N}])/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Words that cost a term against the engines' AND without narrowing anything. */
const QUERY_STOPWORDS = new Set([
  'a',
  'ao',
  'aos',
  'as',
  'às',
  'com',
  'como',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'na',
  'nas',
  'no',
  'nos',
  'o',
  'os',
  'ou',
  'para',
  'pelo',
  'por',
  'qual',
  'quais',
  'que',
  'se',
  'sobre',
  'um',
  'uma',
  'é',
  'an',
  'and',
  'are',
  'for',
  'from',
  'how',
  'in',
  'is',
  'of',
  'on',
  'or',
  'the',
  'to',
  'vs',
  'what',
  'why',
  'with',
]);

/**
 * A proper noun, an API name or a version number is what makes a query find the
 * page the model had in mind; a generic verb is what it can afford to lose.
 */
function isDistinctive(term: string): boolean {
  return /[\p{Lu}]/u.test(term) || /[0-9_]/.test(term);
}

/**
 * Rewrites a query that came back empty into the shortest version still worth
 * searching. Slicing off the head instead — which is what this used to do —
 * keeps the stopwords a query opens with and throws away the proper noun it
 * ends with, so the retry misses for the same reason the original did.
 */
export function relaxQuery(query: string): string {
  const kept = query
    .split(/\s+/)
    .filter((term) => term && !QUERY_STOPWORDS.has(term.toLowerCase()));
  if (kept.length <= MAX_QUERY_TERMS) return kept.join(' ');

  return kept
    .map((term, index) => ({ term, index }))
    .sort(
      (a, b) =>
        Number(isDistinctive(b.term)) - Number(isDistinctive(a.term)) ||
        a.index - b.index,
    )
    .slice(0, MAX_QUERY_TERMS)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.term)
    .join(' ');
}

/** Loose enough that a reworded repeat of a query still counts as the same one. */
function queryKey(query: string): string {
  const key = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // A query written entirely outside the latin alphabet loses everything to the
  // stripping above, so fall back to comparing it as it came.
  return key || query.toLowerCase().trim();
}

/**
 * The queue of things still worth searching. Sources and the reflection step
 * both feed it, which is what turns a fixed plan into a search that follows
 * whatever the pages actually reveal.
 */
class Frontier {
  private pending: FrontierEntry[] = [];
  private seen = new Set<string>();

  get size(): number {
    return this.pending.length;
  }

  push(queries: string[], depth: number, origin: QueryOrigin): FrontierEntry[] {
    if (depth > MAX_FRONTIER_DEPTH) return [];
    const added: FrontierEntry[] = [];
    for (const raw of queries) {
      const query = sanitizeQuery(raw);
      if (!query) continue;
      const key = queryKey(query);
      // Never search the same ground twice, whoever proposed it.
      if (!key || this.seen.has(key)) continue;
      this.seen.add(key);
      const entry = { query, depth, origin };
      this.pending.push(entry);
      added.push(entry);
    }
    return added;
  }

  /** Shallowest first, so the plan is exhausted before chasing side threads. */
  take(limit: number): FrontierEntry[] {
    this.pending.sort((a, b) => a.depth - b.depth);
    return this.pending.splice(0, limit);
  }
}

/**
 * Deep research as a frontier search with a reflection loop: plan many angles,
 * search them in parallel, triage the results, read the ones worth reading,
 * compress each page down to the claims and the loose threads it opens, follow
 * those threads recursively, and only once the material clears an evidence bar
 * cross-analyse everything and write the report.
 *
 * The per-source compression step is what makes this work at all — feeding
 * dozens of pages of markdown straight into a synthesis call would blow the
 * context window and bury the findings.
 */
export class DeepResearchService {
  constructor(
    private responsesClient: ResponsesClient = new ResponsesClient(),
    private searxng: SearxngClient = new SearxngClient(),
    private fetchPage: PageFetcher = createPageFetcher(),
    private now: () => number = Date.now,
  ) {}

  async run(request: DeepResearchRequest): Promise<DeepResearchResult> {
    const trace = request.trace ?? NOOP_TRACE;
    const report = request.onProgress ?? (() => undefined);
    const startedAt = this.now();
    // The loop hands back the reserve so the report is never the step that gets
    // cut; a research pass with no write-up is worth nothing.
    const loopDeadlineAt =
      startedAt + RESEARCH_DEADLINE_MS - SYNTHESIS_RESERVE_MS;

    const plan = await this.plan(request.query, trace);
    report(
      'plan',
      `Plano traçado: ${plan.facets.length} faceta(s), ${plan.subQueries.length} frentes de busca.\n${plan.subQueries
        .map((sub) => `- [${sub.angle}] ${sub.query}`)
        .join('\n')}`,
    );

    const frontier = new Frontier();
    frontier.push(
      plan.subQueries.map((sub) => sub.query),
      0,
      'plan',
    );

    const extractions: NumberedExtraction[] = [];
    const visited = new Set<string>();
    let round = 0;
    let searchesUsed = 0;
    let fetchesUsed = 0;
    let maxDepth = 0;
    let searchErrors = 0;
    let truncatedByBudget = false;

    while (round < MAX_ROUNDS && frontier.size > 0) {
      if (this.now() >= loopDeadlineAt) {
        truncatedByBudget = true;
        report(
          'budget',
          'Tempo da pesquisa esgotado; vou escrever com o que já tenho.',
        );
        break;
      }

      const allowedSearches = Math.min(
        QUERIES_PER_ROUND,
        frontier.size,
        MAX_SEARCHES - searchesUsed,
      );
      if (allowedSearches <= 0) {
        truncatedByBudget = true;
        report(
          'budget',
          'Orçamento de buscas esgotado; partindo para o relatório.',
        );
        break;
      }

      const remainingFetches = MAX_FETCHES - fetchesUsed;
      if (remainingFetches <= 0) {
        truncatedByBudget = true;
        report(
          'budget',
          'Orçamento de páginas esgotado; partindo para o relatório.',
        );
        break;
      }

      // Counted only once the round is actually going to do work, so a round
      // aborted by a budget guard is not reported as one that happened.
      round++;
      const entries = frontier.take(allowedSearches);
      const roundDepth = entries[0]!.depth;
      maxDepth = Math.max(maxDepth, ...entries.map((entry) => entry.depth));
      report(
        'search',
        `Rodada ${round} (profundidade ${roundDepth}): buscando ${entries.length} consulta(s).\n${entries
          .map((entry) => `- ${entry.query}`)
          .join('\n')}`,
      );
      const { hitsByQuery, errors } = await this.search(
        entries.map((entry) => entry.query),
        trace,
      );
      searchesUsed += entries.length;
      if (errors.length > 0) {
        searchErrors += errors.length;
        report(
          'search_failed',
          `${errors.length} de ${entries.length} busca(s) falharam: ${errors[0]}`,
        );
      }

      const candidates = rankHits(hitsByQuery, {
        maxPerDomain: MAX_PER_DOMAIN,
        limit: TRIAGE_POOL + visited.size,
      })
        .filter((hit) => !visited.has(normalizeUrl(hit.url)))
        // Dropped before triage rather than inside its prompt, because a model
        // told to prefer official sources will pick the PDF every time.
        .filter((hit) => !UNREADABLE_EXTENSIONS.test(hit.url))
        .slice(0, TRIAGE_POOL);

      const selected = candidates.length
        ? await this.triage(
            plan,
            this.facetCoverage(plan, extractions),
            candidates,
            Math.min(SOURCES_PER_ROUND, remainingFetches),
            round,
            trace,
          )
        : [];
      report(
        'triage',
        `${selected.length} de ${candidates.length} resultado(s) valem leitura.`,
      );

      if (selected.length > 0) {
        for (const hit of selected) visited.add(normalizeUrl(hit.url));
        report(
          'read',
          `Lendo ${selected.length} página(s):\n${selected
            .map((hit) => `- ${hit.title}`)
            .join('\n')}`,
        );

        const round_ = round;
        const outcomes = await mapWithConcurrency(
          selected,
          FETCH_CONCURRENCY,
          (hit) => this.readAndExtract(plan, hit, trace, round_),
        );
        fetchesUsed += selected.length;

        const followUps: string[] = [];
        const failures: { url: string; reason: string }[] = [];
        for (const outcome of outcomes) {
          if (!outcome.ok) {
            failures.push({ url: outcome.url, reason: outcome.reason });
            continue;
          }
          extractions.push({
            ...outcome.source,
            index: extractions.length + 1,
          });
          if (outcome.source.extraction.relevant) {
            followUps.push(...outcome.source.extraction.followUpQueries);
          }
        }

        // A page that never opened used to vanish without a word, which made a
        // report built on two of ten sources look like a report built on ten.
        if (failures.length > 0) {
          report(
            'read_failed',
            `${failures.length} de ${selected.length} página(s) não abriram:\n${failures
              .map(
                (failure) =>
                  `- ${hostOf(failure.url)}: ${failure.reason.slice(0, 160)}`,
              )
              .join('\n')}`,
          );
        }

        const relevant = extractions.filter(
          (entry) => entry.extraction.relevant,
        ).length;
        report(
          'extract',
          `${relevant} de ${extractions.length} fonte(s) úteis até aqui.`,
        );

        const added = frontier.push(followUps, roundDepth + 1, 'source');
        if (added.length > 0) {
          report(
            'follow',
            `As fontes abriram ${added.length} pista(s) nova(s):\n${added
              .map((entry) => `- ${entry.query}`)
              .join('\n')}`,
          );
        }
      }

      if (round >= MAX_ROUNDS) break;
      // Nothing read yet means there is nothing to audit; the frontier still
      // has queries, so keep searching instead of burning a reflection call.
      if (extractions.length === 0) continue;

      const reflection = await this.reflect(
        plan,
        this.facetCoverage(plan, extractions),
        extractions,
        round,
        trace,
      );
      frontier.push(reflection.followUpQueries, roundDepth + 1, 'reflection');

      if (reflection.sufficient && this.floorMet(plan, extractions, round)) {
        report('reflect', 'Material suficiente. Escrevendo o relatório.');
        break;
      }
      if (reflection.gaps.length > 0) {
        report(
          'reflect',
          `Lacunas encontradas:\n${reflection.gaps.map((gap) => `- ${gap}`).join('\n')}`,
        );
      }
    }

    // Hitting the round cap with queries still queued is a budget cut like any
    // other, and the report has to admit it.
    if (round >= MAX_ROUNDS && frontier.size > 0) truncatedByBudget = true;

    const usable = extractions.filter((entry) => entry.extraction.relevant);
    // Renumber so the citations the model is given are contiguous; a gap in the
    // list is an invitation to cite a number that has no source behind it.
    const numbered = usable.map((extraction, index) => ({
      ...extraction,
      index: index + 1,
    }));

    let analysis: ResearchAnalysis | undefined;
    if (numbered.length > 0) {
      report('analyze', `Cruzando o que ${numbered.length} fonte(s) disseram.`);
      analysis = await this.analyze(plan, numbered, trace);
    }

    report(
      'synthesize',
      `Sintetizando o relatório com ${numbered.length} fonte(s).`,
    );
    const reportText = await this.synthesize(
      plan,
      request.query,
      numbered,
      analysis,
      truncatedByBudget,
      searchErrors,
      trace,
    );

    return {
      report: reportText,
      sources: numbered.map((entry) => ({
        index: entry.index,
        url: entry.url,
        title: entry.title,
        ...(entry.extraction.publishedDate
          ? { publishedDate: entry.extraction.publishedDate }
          : {}),
      })),
      stats: {
        rounds: round,
        searches: searchesUsed,
        fetched: fetchesUsed,
        relevantSources: numbered.length,
        maxDepth,
        durationMs: this.now() - startedAt,
        ...(truncatedByBudget ? { truncatedByBudget: true } : {}),
      },
    };
  }

  /** Relevant sources backing each facet of the plan. */
  private facetCoverage(
    plan: ResearchPlan,
    extractions: NumberedExtraction[],
  ): Map<string, number> {
    const coverage = new Map<string, number>(
      plan.facets.map((facet) => [facet.id, 0]),
    );
    for (const entry of extractions) {
      if (!entry.extraction.relevant) continue;
      for (const facetId of entry.extraction.facetIds) {
        if (!coverage.has(facetId)) continue;
        coverage.set(facetId, coverage.get(facetId)! + 1);
      }
    }
    return coverage;
  }

  /**
   * The bar below which "material suficiente" is not the auditor's call to
   * make: too few rounds, too few sources, or a facet nobody covered.
   */
  private floorMet(
    plan: ResearchPlan,
    extractions: NumberedExtraction[],
    round: number,
  ): boolean {
    if (round < MIN_ROUNDS) return false;
    const relevant = extractions.filter((entry) => entry.extraction.relevant);
    if (relevant.length < MIN_RELEVANT_SOURCES) return false;
    const coverage = this.facetCoverage(plan, relevant);
    return plan.facets.every(
      (facet) => (coverage.get(facet.id) ?? 0) >= MIN_SOURCES_PER_FACET,
    );
  }

  private async plan(
    query: string,
    trace: TraceContext,
  ): Promise<ResearchPlan> {
    return this.responsesClient.structured({
      instructions: RESEARCH_PLAN_PROMPT,
      input: [{ role: 'user', content: buildPlanInput(query) }],
      schema: researchPlanSchema,
      schemaName: 'research_plan',
      maxOutputTokens: PLAN_MAX_TOKENS,
      reasoningEffort: PLAN_EFFORT,
      trace,
      phase: 'research_plan',
    });
  }

  private async search(
    queries: string[],
    trace: TraceContext,
  ): Promise<{ hitsByQuery: SearchHit[][]; errors: string[] }> {
    const errors: string[] = [];
    const hitsByQuery = await mapWithConcurrency(
      queries,
      SEARCH_CONCURRENCY,
      async (query) => {
        try {
          const hits = await this.searxng.search(query, {
            limit: HITS_PER_QUERY,
            language: 'pt-BR',
          });
          if (hits.length > 0) return hits;

          // Every term is ANDed by the engines behind SearXNG, so a long
          // keyword string narrows itself down to nothing. A relaxed version
          // usually matches plenty, and one extra search is cheap next to a
          // dead round.
          const shortened = relaxQuery(query);
          if (!shortened || shortened === query) return hits;
          logger.info('ai.research.search_shortened', {
            traceId: trace.traceId,
            query,
            shortened,
          });
          return await this.searxng.search(shortened, {
            limit: HITS_PER_QUERY,
            language: 'pt-BR',
          });
        } catch (error) {
          // One dead sub-query must not kill the round; the other angles still
          // produce a report. But a search that errored is not a search that
          // found nothing, and the difference has to reach the user.
          const message = (error as Error).message;
          errors.push(message);
          logger.warn('ai.research.search_failed', {
            traceId: trace.traceId,
            query,
            error: message,
          });
          return [];
        }
      },
    );
    return { hitsByQuery, errors };
  }

  /**
   * Picks which of the ranked candidates are worth the cost of being read.
   * Ranking alone only knows how many engines liked a page, which is how an
   * SEO-optimised aggregator outranks the primary source it copied from.
   */
  private async triage(
    plan: ResearchPlan,
    coverage: Map<string, number>,
    candidates: RankedHit[],
    limit: number,
    round: number,
    trace: TraceContext,
  ): Promise<RankedHit[]> {
    const byUrl = new Map(candidates.map((hit) => [hit.url, hit]));

    try {
      const { picks } = await this.responsesClient.structured({
        instructions: RESEARCH_TRIAGE_PROMPT,
        input: [
          {
            role: 'user',
            content: buildTriageInput(
              plan.objective,
              plan.facets,
              coverage,
              candidates.map((hit) => ({
                url: hit.url,
                title: hit.title,
                snippet: hit.snippet,
                queryAgreement: hit.queryAgreement,
              })),
            ),
          },
        ],
        schema: triageSchema,
        schemaName: 'research_triage',
        maxOutputTokens: TRIAGE_MAX_TOKENS,
        reasoningEffort: TRIAGE_EFFORT,
        trace,
        phase: `research_triage[round=${round}]`,
      });

      const selected: RankedHit[] = [];
      const taken = new Set<string>();
      for (const pick of [...picks].sort(
        (a, b) =>
          (a.priority === 'alta' ? 0 : 1) - (b.priority === 'alta' ? 0 : 1),
      )) {
        const hit = byUrl.get(pick.url);
        // A url the model invented is not a candidate we ever saw ranked.
        if (!hit || taken.has(pick.url)) continue;
        taken.add(pick.url);
        selected.push(hit);
        if (selected.length >= limit) break;
      }
      return selected;
    } catch (error) {
      // Losing the triage call costs precision, not the round: fall back to the
      // ranking, which is what the pipeline used before triage existed.
      logger.warn('ai.research.triage_failed', {
        traceId: trace.traceId,
        error: (error as Error).message,
      });
      return candidates.slice(0, limit);
    }
  }

  private async readAndExtract(
    plan: ResearchPlan,
    hit: SearchHit,
    trace: TraceContext,
    round: number,
  ): Promise<ReadOutcome> {
    let content: string;
    let title = hit.title;
    try {
      const page = await this.fetchPage(hit.url, {
        mode: 'text',
        timeoutMs: SOURCE_FETCH_TIMEOUT_MS,
      });
      content = page.content.slice(0, SOURCE_CONTENT_CHARS);
      if (page.title) title = page.title;
      if (!content.trim()) {
        return { ok: false, url: hit.url, reason: 'página sem texto algum' };
      }
    } catch (error) {
      if (!(error instanceof FetchPageError)) throw error;
      logger.info('ai.research.fetch_skipped', {
        traceId: trace.traceId,
        url: hit.url,
        reason: error.message,
      });
      return { ok: false, url: hit.url, reason: error.message };
    }

    try {
      const extraction = await this.responsesClient.structured({
        instructions: SOURCE_EXTRACTION_PROMPT,
        input: [
          {
            role: 'user',
            content: buildExtractionInput(plan.objective, plan.facets, {
              url: hit.url,
              title,
              content,
            }),
          },
        ],
        schema: sourceExtractionSchema,
        schemaName: 'source_extraction',
        maxOutputTokens: EXTRACTION_MAX_TOKENS,
        reasoningEffort: EXTRACTION_EFFORT,
        trace,
        phase: `research_extract[round=${round}]`,
      });
      return { ok: true, source: { url: hit.url, title, extraction } };
    } catch (error) {
      logger.warn('ai.research.extract_failed', {
        traceId: trace.traceId,
        url: hit.url,
        error: (error as Error).message,
      });
      return {
        ok: false,
        url: hit.url,
        reason: `falha ao interpretar a página: ${(error as Error).message}`,
      };
    }
  }

  private async reflect(
    plan: ResearchPlan,
    coverage: Map<string, number>,
    extractions: NumberedExtraction[],
    round: number,
    trace: TraceContext,
  ) {
    try {
      return await this.responsesClient.structured({
        instructions: RESEARCH_REFLECTION_PROMPT,
        input: [
          {
            role: 'user',
            content: buildReflectionInput(
              plan.objective,
              plan.facets,
              coverage,
              extractions,
              round,
            ),
          },
        ],
        schema: reflectionSchema,
        schemaName: 'research_reflection',
        maxOutputTokens: REFLECTION_MAX_TOKENS,
        reasoningEffort: REFLECTION_EFFORT,
        trace,
        phase: `research_reflect[round=${round}]`,
      });
    } catch (error) {
      // If the auditor fails we stop researching rather than loop blindly:
      // writing the report from what we have beats spending more budget on
      // queries nobody vetted.
      logger.warn('ai.research.reflection_failed', {
        traceId: trace.traceId,
        error: (error as Error).message,
      });
      return { sufficient: true, gaps: [], followUpQueries: [] };
    }
  }

  /**
   * Cross-reads every source before a single line is written. Asking one call
   * to both reconcile the material and write the prose is what produces a
   * report shaped like a list of summaries.
   */
  private async analyze(
    plan: ResearchPlan,
    sources: NumberedExtraction[],
    trace: TraceContext,
  ): Promise<ResearchAnalysis | undefined> {
    try {
      return await this.responsesClient.structured({
        instructions: RESEARCH_ANALYSIS_PROMPT,
        input: [
          {
            role: 'user',
            content: buildAnalysisInput(plan.objective, plan.facets, sources),
          },
        ],
        schema: researchAnalysisSchema,
        schemaName: 'research_analysis',
        maxOutputTokens: ANALYSIS_MAX_TOKENS,
        reasoningEffort: ANALYSIS_EFFORT,
        trace,
        phase: 'research_analyze',
      });
    } catch (error) {
      // The report is still writable straight from the extractions, just with
      // less structure — better than losing a job that took ten minutes.
      logger.warn('ai.research.analysis_failed', {
        traceId: trace.traceId,
        error: (error as Error).message,
      });
      return undefined;
    }
  }

  private async synthesize(
    plan: ResearchPlan,
    originalQuery: string,
    sources: NumberedExtraction[],
    analysis: ResearchAnalysis | undefined,
    truncatedByBudget: boolean,
    searchErrors: number,
    trace: TraceContext,
  ): Promise<string> {
    if (sources.length === 0) {
      // Blaming the user's topic when it was our search backend that fell over
      // sends them off to reword a question that was never the problem.
      if (searchErrors > 0) {
        return `## Resumo\n\nNão consegui pesquisar "${originalQuery}": ${searchErrors} busca(s) falharam no motor de busca, então não teve material para ler. Isso é problema do meu lado, não do teu tema.\n\n## Divergências e limites\n\nSem busca não tem fonte, e sem fonte não tem relatório. Tenta de novo em alguns minutos.`;
      }
      return `## Resumo\n\nNão achei fonte utilizável para "${originalQuery}". As buscas responderam, mas não devolveram página que servisse ao objetivo, ou as que devolveram não abriram.\n\n## Divergências e limites\n\nSem fonte não tem relatório. Tenta reformular o tema com termos mais específicos.`;
    }

    const budgetNote = truncatedByBudget
      ? 'A pesquisa parou por limite de tempo ou de orçamento antes de esgotar o tema. Diga isso explicitamente na seção de limites.'
      : undefined;

    const response = await this.responsesClient.create({
      instructions: RESEARCH_SYNTHESIS_PROMPT,
      input: [
        {
          role: 'user',
          content: buildSynthesisInput(
            plan.objective,
            originalQuery,
            sources,
            analysis,
            budgetNote,
          ),
        },
      ],
      maxOutputTokens: SYNTHESIS_MAX_TOKENS,
      reasoningEffort: SYNTHESIS_EFFORT,
      trace,
      phase: 'research_synthesize',
    });

    return response.text.trim();
  }
}
