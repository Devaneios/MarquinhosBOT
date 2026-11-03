import { expect, it } from 'bun:test';
import { previousRecifeDate } from './termoDate';

it('returns the closed Recife day around midnight and month boundaries', () => {
  expect(previousRecifeDate(new Date('2026-11-01T03:00:00Z'))).toBe(
    '2026-10-31',
  );
  expect(previousRecifeDate(new Date('2026-11-01T02:59:59Z'))).toBe(
    '2026-10-30',
  );
});
