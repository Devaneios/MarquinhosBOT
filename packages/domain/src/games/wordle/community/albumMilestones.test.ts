import { expect, it } from 'bun:test';
import { reconcileAlbumMilestone } from './albumMilestones';

it('fixes the completed catalog and revises the milestone when evidence is removed', () => {
  const first = reconcileAlbumMilestone(
    null,
    ['a', 'b'],
    new Set(['a', 'b']),
    100,
  );
  expect(first).toEqual({
    patternIds: ['a', 'b'],
    completedAt: 100,
    revisedAt: null,
    status: 'completed',
  });
  expect(
    reconcileAlbumMilestone(first, ['a', 'b', 'c'], new Set(['a', 'b']), 200),
  ).toEqual(first);
  expect(
    reconcileAlbumMilestone(first, ['a', 'b', 'c'], new Set(['b']), 300),
  ).toEqual({ ...first!, status: 'revised', revisedAt: 300 });
  const revised = reconcileAlbumMilestone(
    first,
    ['a', 'b'],
    new Set(['b']),
    300,
  );
  expect(
    reconcileAlbumMilestone(revised, ['a', 'b'], new Set(['a', 'b']), 400),
  ).toEqual({ ...first!, status: 'completed', revisedAt: 400 });
  expect(
    reconcileAlbumMilestone(null, ['a', 'b'], new Set(['a']), 100),
  ).toBeNull();
});
