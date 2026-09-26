import type { KeyboardKey } from '@/games/shared/keyboard';
import type { WordleUserConfig } from '@marquinhos/contracts/wordle';

export const KB_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
export const KB_LETTERS = new Set(KB_ROWS.join(''));
export const MIN_KEY_PRESS_MS = 100;
export const FLIP_STAGGER_MS = 275;
export const FLIP_DURATION_MS = 400;
export const BOUNCE_STAGGER_MS = 100;
export const BOUNCE_DURATION_MS = 480;
export const ENTRANCE_MS = 800;

export function revealDurationMs(wordLength: number): number {
  return (wordLength - 1) * FLIP_STAGGER_MS + FLIP_DURATION_MS;
}
export const WORDLE_FOCUS_KEYS = {
  first: 'MoveFirst',
  left: 'MoveLeft',
  space: 'Space',
  right: 'MoveRight',
  last: 'MoveLast',
} as const;
const KEY_PRESS_SOUND = '/keypress.ogg';
const BACKSPACE_SOUND = '/backspace.ogg';
const ENTER_SOUND = '/enter.ogg';

export function buildKeyboardRows({
  invertActionKeys,
  enableSounds,
  enableSpaceKey,
  enableArrowKeys,
}: WordleUserConfig): KeyboardKey[][] {
  const rows = KB_ROWS.map((row, index) => {
    const keys: KeyboardKey[] = row.split('').map((letter) => ({
      id: letter,
      label: letter,
      sound: enableSounds ? KEY_PRESS_SOUND : undefined,
    }));
    if (index === KB_ROWS.length - 1) {
      const backspace: KeyboardKey = {
        id: 'Backspace',
        label: '⌫',
        variant: 'medium',
        sound: enableSounds ? BACKSPACE_SOUND : undefined,
      };
      const enter: KeyboardKey = {
        id: 'Enter',
        label: '⏎',
        variant: 'wide',
        sound: enableSounds ? ENTER_SOUND : undefined,
      };

      keys.unshift(invertActionKeys ? backspace : enter);
      keys.push(invertActionKeys ? enter : backspace);
    }
    return keys;
  });

  if (!enableSpaceKey) return rows;

  const space: KeyboardKey = {
    id: WORDLE_FOCUS_KEYS.space,
    label: 'ESPAÇO',
    variant: 'space',
  };
  if (!enableArrowKeys) return [...rows, [space]];

  return [
    ...rows,
    [
      { id: WORDLE_FOCUS_KEYS.first, label: '<<' },
      { id: WORDLE_FOCUS_KEYS.left, label: '<' },
      space,
      { id: WORDLE_FOCUS_KEYS.right, label: '>' },
      { id: WORDLE_FOCUS_KEYS.last, label: '>>' },
    ],
  ];
}
