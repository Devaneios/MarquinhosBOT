import { describe, expect, it } from 'bun:test';
import { snapToLine } from './selection';

describe('snapToLine', () => {
  it('keeps equal row and column travel diagonal', () => {
    expect(snapToLine({ row: 2, col: 2 }, { row: 5, col: 5 })).toEqual({
      row: 5,
      col: 5,
    });
  });

  it('snaps uneven diagonal travel to the dominant axis', () => {
    expect(snapToLine({ row: 2, col: 2 }, { row: 6, col: 3 })).toEqual({
      row: 6,
      col: 2,
    });
  });
});
