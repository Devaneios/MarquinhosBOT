import { expect, it } from 'bun:test';
import { visibleWordleEvidence } from '../src/services/wordle/wordleEvidenceVisibility';

it('shows the owner their fixed evidence and masks the active day for others', () => {
  const evidence = { date: '2026-11-03', patternId: 'x' };
  expect(
    visibleWordleEvidence(evidence, 'owner', 'owner', '2026-11-03'),
  ).toEqual(evidence);
  expect(
    visibleWordleEvidence(evidence, 'owner', 'other', '2026-11-03'),
  ).toBeNull();
  expect(
    visibleWordleEvidence(evidence, 'owner', 'other', '2026-11-04'),
  ).toEqual(evidence);
  expect(
    visibleWordleEvidence(null, 'owner', 'other', '2026-11-04'),
  ).toBeNull();
});
