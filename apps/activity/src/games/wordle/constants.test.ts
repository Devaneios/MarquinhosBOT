import { describe, expect, it } from 'bun:test';
import { buildKeyboardRows } from './constants';

describe('buildKeyboardRows', () => {
  it('keeps the current action-key order and disables sounds by default', () => {
    const rows = buildKeyboardRows({
      invertActionKeys: false,
      enableSounds: false,
      enableSpaceKey: false,
      enableArrowKeys: false,
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
    expect(rows).toHaveLength(3);
  });

  it('inverts action keys and assigns each sound when enabled', () => {
    const rows = buildKeyboardRows({
      invertActionKeys: true,
      enableSounds: true,
      enableSpaceKey: false,
      enableArrowKeys: false,
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

  it('adds a centered space row without arrow keys', () => {
    const rows = buildKeyboardRows({
      invertActionKeys: false,
      enableSounds: false,
      enableSpaceKey: true,
      enableArrowKeys: false,
    });

    expect(rows[3]).toEqual([
      { id: 'Space', label: 'ESPAÇO', variant: 'space' },
    ]);
  });

  it('places arrow keys around space in the new row', () => {
    const rows = buildKeyboardRows({
      invertActionKeys: false,
      enableSounds: false,
      enableSpaceKey: true,
      enableArrowKeys: true,
    });

    expect(rows[3]?.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'MoveFirst', label: '<<' },
      { id: 'MoveLeft', label: '<' },
      { id: 'Space', label: 'ESPAÇO' },
      { id: 'MoveRight', label: '>' },
      { id: 'MoveLast', label: '>>' },
    ]);
  });
});
