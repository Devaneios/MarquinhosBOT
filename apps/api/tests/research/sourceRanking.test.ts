import { describe, expect, it } from 'bun:test';
import { normalizeUrl, rankHits } from 'services/aiChat/research/sourceRanking';
import type { SearchHit } from 'services/aiChat/web/SearxngClient';

function hit(url: string, overrides: Partial<SearchHit> = {}): SearchHit {
  return {
    url,
    title: url,
    snippet: '',
    engines: ['google'],
    score: 1,
    ...overrides,
  };
}

describe('normalizeUrl', () => {
  it('drops the fragment', () => {
    expect(normalizeUrl('https://a.com/p#secao')).toBe('https://a.com/p');
  });

  it('drops tracking params but keeps meaningful query params', () => {
    expect(
      normalizeUrl('https://a.com/p?id=7&utm_source=x&fbclid=y&gclid=z'),
    ).toBe('https://a.com/p?id=7');
  });

  it('strips a www prefix and lowercases the host', () => {
    expect(normalizeUrl('https://WWW.Example.COM/p')).toBe(
      'https://example.com/p',
    );
  });

  it('drops a trailing slash except on the root', () => {
    expect(normalizeUrl('https://a.com/p/')).toBe('https://a.com/p');
    expect(normalizeUrl('https://a.com/')).toBe('https://a.com/');
  });

  it('returns a malformed url untouched instead of throwing', () => {
    expect(normalizeUrl('not a url')).toBe('not a url');
  });
});

describe('rankHits', () => {
  it('merges the same page found by different sub-queries into one hit', () => {
    const ranked = rankHits([
      [hit('https://a.com/p')],
      [hit('https://www.a.com/p/#x')],
    ]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.queryAgreement).toBe(2);
  });

  it('ranks a page found by two sub-queries above a higher-scoring page found by one', () => {
    const ranked = rankHits([
      [
        hit('https://agree.com/p', { score: 1 }),
        hit('https://solo.com/p', { score: 2 }),
      ],
      [hit('https://agree.com/p', { score: 1 })],
    ]);

    expect(ranked[0]?.url).toBe('https://agree.com/p');
  });

  it('rewards agreement between engines', () => {
    const ranked = rankHits([
      [
        hit('https://many.com/p', {
          score: 1,
          engines: ['google', 'bing', 'ddg', 'brave'],
        }),
        hit('https://one.com/p', { score: 1, engines: ['google'] }),
      ],
    ]);

    expect(ranked[0]?.url).toBe('https://many.com/p');
  });

  it('does not double-count a url repeated within the same sub-query', () => {
    const ranked = rankHits([[hit('https://a.com/p'), hit('https://a.com/p')]]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.queryAgreement).toBe(1);
  });

  it('caps how many pages come from one domain so a report is not one voice', () => {
    const ranked = rankHits(
      [
        [
          hit('https://seo.com/1', { score: 9 }),
          hit('https://seo.com/2', { score: 8 }),
          hit('https://seo.com/3', { score: 7 }),
          hit('https://other.com/1', { score: 1 }),
        ],
      ],
      { maxPerDomain: 2 },
    );

    expect(ranked.filter((h) => h.url.includes('seo.com'))).toHaveLength(2);
    expect(ranked.some((h) => h.url.includes('other.com'))).toBe(true);
  });

  it('treats www and non-www as the same domain for the cap', () => {
    const ranked = rankHits(
      [
        [
          hit('https://seo.com/1'),
          hit('https://www.seo.com/2'),
          hit('https://seo.com/3'),
        ],
      ],
      { maxPerDomain: 2 },
    );

    expect(ranked).toHaveLength(2);
  });

  it('honours the overall limit', () => {
    const hits = Array.from({ length: 20 }, (_, i) =>
      hit(`https://d${i}.com/p`),
    );

    expect(rankHits([hits], { limit: 5 })).toHaveLength(5);
  });

  it('returns an empty list when no query found anything', () => {
    expect(rankHits([[], []])).toEqual([]);
  });

  it('preserves the fetchable url, not the normalized one', () => {
    const ranked = rankHits([[hit('https://www.a.com/p?utm_source=x')]]);

    expect(ranked[0]?.url).toBe('https://www.a.com/p?utm_source=x');
  });
});

describe('rankHits exclude', () => {
  it('lets an excluded url free up the domain slot it used to occupy', () => {
    // Three pages of one domain plus a fourth already read. Without exclude the
    // read one eats a slot of the cap and the fresh third page never surfaces,
    // which is how a later round ends up with zero candidates.
    const hits = [
      [
        hit('https://godot.org/lido', { score: 9 }),
        hit('https://godot.org/a', { score: 3 }),
        hit('https://godot.org/b', { score: 2 }),
        hit('https://godot.org/c', { score: 1 }),
      ],
    ];

    const ranked = rankHits(hits, {
      maxPerDomain: 3,
      exclude: new Set([normalizeUrl('https://godot.org/lido')]),
    });

    expect(ranked.map((entry) => entry.url)).toEqual([
      'https://godot.org/a',
      'https://godot.org/b',
      'https://godot.org/c',
    ]);
  });

  it('matches the exclude set on the normalized url, not the raw one', () => {
    const hits = [
      [hit('https://WWW.Godot.org/p/?utm_source=x'), hit('https://b.com/1')],
    ];

    const ranked = rankHits(hits, {
      exclude: new Set([normalizeUrl('https://godot.org/p')]),
    });

    expect(ranked.map((entry) => entry.url)).toEqual(['https://b.com/1']);
  });

  it('ranks exactly as before when no exclude set is given', () => {
    const hits = [[hit('https://a.com/1'), hit('https://b.com/2')]];

    expect(rankHits(hits).map((entry) => entry.url)).toEqual([
      'https://a.com/1',
      'https://b.com/2',
    ]);
  });
});
