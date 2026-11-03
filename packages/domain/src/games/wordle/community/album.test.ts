import { describe, expect, it } from 'bun:test';
import { buildAlbumPages } from './album';

describe('community album projection', () => {
  const catalog = [
    { patternId: 'a', family: 'letters' },
    { patternId: 'b', family: 'letters' },
  ];
  it('counts distinct contributors and selects the earliest recorded occurrence with a deterministic tie break', () => {
    const pages = buildAlbumPages(catalog, [
      { occurrenceId: 'b', patternId: 'a', userId: 'second', occurredAt: 10 },
      { occurrenceId: 'a', patternId: 'a', userId: 'first', occurredAt: 10 },
      { occurrenceId: 'c', patternId: 'a', userId: 'first', occurredAt: 11 },
      { occurrenceId: 'c', patternId: 'a', userId: 'first', occurredAt: 11 },
    ]);
    expect(pages).toEqual([
      {
        patternId: 'a',
        family: 'letters',
        contributorCount: 2,
        contributors: ['first', 'second'],
        firstContribution: {
          occurrenceId: 'a',
          patternId: 'a',
          userId: 'first',
          occurredAt: 10,
        },
      },
      {
        patternId: 'b',
        family: 'letters',
        contributorCount: 0,
        contributors: [],
        firstContribution: null,
      },
    ]);
  });
  it('reassigns credit after removal and leaves the page available when no contributions remain', () => {
    const later = {
      occurrenceId: 'later',
      patternId: 'a',
      userId: 'second',
      occurredAt: 20,
    };
    expect(buildAlbumPages(catalog, [later])[0]?.firstContribution).toEqual(
      later,
    );
    expect(buildAlbumPages(catalog, [])[0]?.firstContribution).toBeNull();
  });
});
