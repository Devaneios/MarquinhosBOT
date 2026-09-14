import { describe, expect, it } from 'bun:test';
import { buildKeyboardRows } from './constants';

describe('buildKeyboardRows', () => {
  it('keeps the current action-key order and disables sounds by default', () => {
    const rows = buildKeyboardRows({
      invertActionKeys: false,
      enableSounds: false,
    });

    expect(rows[2]?.map(({ id }) => id)).toEqual([
      'Enter',
      'z',
      'x',
      'c',
      'v',
      'b',
      'n',
      'm',
      'Backspace',
    ]);
    expect(rows.flat().every((key) => key.sound === undefined)).toBe(true);
  });

  it('inverts action keys and assigns each sound when enabled', () => {
    const rows = buildKeyboardRows({
      invertActionKeys: true,
      enableSounds: true,
    });

    expect(rows[2]?.map(({ id }) => id)).toEqual([
      'Backspace',
      'z',
      'x',
      'c',
      'v',
      'b',
      'n',
      'm',
      'Enter',
    ]);
    expect(rows[0]?.[0]?.sound).toBe('/keypress.ogg');
    expect(rows[2]?.[0]?.sound).toBe('/backspace.ogg');
    expect(rows[2]?.at(-1)?.sound).toBe('/enter.ogg');
  });
});
