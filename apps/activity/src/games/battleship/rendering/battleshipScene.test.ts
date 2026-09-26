import { describe, expect, it } from 'bun:test';
import {
  cellAt,
  computeLayout,
  hullFor,
  isInsideGrid,
  takeNewShots,
} from './battleshipScene';

describe('computeLayout', () => {
  it('places two boards side by side on a wide container', () => {
    const layout = computeLayout(1000, 2);
    expect(layout.arrangement).toBe('row');
    expect(layout.blocks).toHaveLength(2);
    expect(layout.blocks[1]!.x).toBeGreaterThan(layout.blocks[0]!.x);
    expect(layout.blocks[1]!.y).toBe(0);
    expect(layout.width).toBeLessThanOrEqual(1000);
  });

  it('stacks two boards on a phone-width container', () => {
    const layout = computeLayout(360, 2);
    expect(layout.arrangement).toBe('column');
    expect(layout.blocks[1]!.y).toBeGreaterThan(0);
    expect(layout.blocks[1]!.x).toBe(0);
    expect(layout.width).toBeLessThanOrEqual(360);
  });

  it('clamps the cell size on very wide and very narrow containers', () => {
    expect(computeLayout(5000, 1).cell).toBe(40);
    expect(computeLayout(100, 1).cell).toBe(20);
  });

  it('keeps the grid inside its block', () => {
    const layout = computeLayout(700, 1);
    const block = layout.blocks[0]!;
    expect(block.gridX + layout.cell * 10).toBeLessThanOrEqual(layout.width);
    expect(block.gridY + layout.cell * 10).toBeLessThanOrEqual(layout.height);
  });
});

describe('cellAt', () => {
  it('maps pixel coordinates to grid cells', () => {
    expect(cellAt(0, 0, 30)).toEqual({ x: 0, y: 0 });
    expect(cellAt(29.9, 59.9, 30)).toEqual({ x: 0, y: 1 });
    expect(cellAt(299, 299, 30)).toEqual({ x: 9, y: 9 });
  });

  it('returns null outside the grid', () => {
    expect(cellAt(-1, 5, 30)).toBeNull();
    expect(cellAt(300, 5, 30)).toBeNull();
    expect(cellAt(5, 300, 30)).toBeNull();
  });
});

describe('hullFor', () => {
  it('derives a horizontal hull', () => {
    expect(
      hullFor([
        { x: 2, y: 4 },
        { x: 3, y: 4 },
        { x: 4, y: 4 },
      ]),
    ).toEqual({ x: 2, y: 4, length: 3, orientation: 'horizontal' });
  });

  it('derives a vertical hull regardless of cell order', () => {
    expect(
      hullFor([
        { x: 7, y: 3 },
        { x: 7, y: 1 },
        { x: 7, y: 2 },
      ]),
    ).toEqual({ x: 7, y: 1, length: 3, orientation: 'vertical' });
  });

  it('returns null for no cells', () => {
    expect(hullFor([])).toBeNull();
  });
});

describe('isInsideGrid', () => {
  it('rejects cells past the edges', () => {
    expect(isInsideGrid({ x: 9, y: 9 })).toBe(true);
    expect(isInsideGrid({ x: 10, y: 0 })).toBe(false);
    expect(isInsideGrid({ x: 0, y: -1 })).toBe(false);
  });
});

describe('takeNewShots', () => {
  it('returns each shot once', () => {
    const seen = new Set<string>();
    const first = { x: 1, y: 1, hit: false };
    const second = { x: 2, y: 2, hit: true };

    expect(takeNewShots(seen, [first])).toEqual([first]);
    expect(takeNewShots(seen, [first, second])).toEqual([second]);
    expect(takeNewShots(seen, [first, second])).toEqual([]);
  });
});
