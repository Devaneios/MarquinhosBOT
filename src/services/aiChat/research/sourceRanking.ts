import type { SearchHit } from 'services/aiChat/web/SearxngClient';

/** Params that identify a campaign, not a document — dropping them dedupes more. */
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'fbclid',
  'ref',
  'ref_src',
  'source',
];

/**
 * Canonical form used for dedupe only — never for fetching, since stripping
 * params could in principle change what a server returns.
 */
export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = '';
    for (const param of TRACKING_PARAMS) url.searchParams.delete(param);
    url.hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export interface RankedHit extends SearchHit {
  /** How many distinct sub-queries surfaced this URL. */
  queryAgreement: number;
  rankScore: number;
}

export interface RankOptions {
  maxPerDomain?: number;
  limit?: number;
  /**
   * Normalized urls to leave out. Excluding here rather than filtering the
   * result is what keeps a page already read from spending its domain's share
   * of `maxPerDomain` — the way a later round ends up with no candidates at all
   * while the searches behind it returned plenty.
   */
  exclude?: Set<string>;
}

/**
 * Merges the hits from every sub-query into one ranked shortlist.
 *
 * Three signals, in order of weight: how many engines found the page (SearXNG's
 * own score already encodes this), how many of our sub-queries independently
 * surfaced it, and domain diversity. The last one is a cap rather than a score —
 * without it a single well-SEO'd domain can supply every source in the report,
 * which reads as thorough while actually being one point of view.
 */
export function rankHits(
  hitsByQuery: SearchHit[][],
  options: RankOptions = {},
): RankedHit[] {
  const maxPerDomain = options.maxPerDomain ?? 2;
  const limit = options.limit ?? 12;
  const exclude = options.exclude;

  const merged = new Map<string, RankedHit>();
  for (const hits of hitsByQuery) {
    const seenInThisQuery = new Set<string>();
    for (const hit of hits) {
      const key = normalizeUrl(hit.url);
      if (exclude?.has(key)) continue;
      if (seenInThisQuery.has(key)) continue;
      seenInThisQuery.add(key);

      const existing = merged.get(key);
      if (existing) {
        existing.queryAgreement += 1;
        existing.score = Math.max(existing.score, hit.score);
        if (hit.engines.length > existing.engines.length) {
          existing.engines = hit.engines;
        }
        continue;
      }
      merged.set(key, { ...hit, queryAgreement: 1, rankScore: 0 });
    }
  }

  for (const hit of merged.values()) {
    hit.rankScore =
      hit.score +
      hit.queryAgreement * 1.5 +
      Math.min(hit.engines.length, 4) * 0.5;
  }

  const ordered = [...merged.values()].sort(
    (a, b) => b.rankScore - a.rankScore,
  );

  const perDomain = new Map<string, number>();
  const selected: RankedHit[] = [];
  for (const hit of ordered) {
    if (selected.length >= limit) break;
    let domain: string;
    try {
      domain = new URL(hit.url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      continue;
    }
    const used = perDomain.get(domain) ?? 0;
    if (used >= maxPerDomain) continue;
    perDomain.set(domain, used + 1);
    selected.push(hit);
  }

  return selected;
}
