import {
  BOUNCE_DURATION_MS,
  BOUNCE_STAGGER_MS,
  revealDurationMs,
} from './constants';

export const WORD_LENGTH = 5;
export const ROWS = 4;
const SUBMIT_PAUSE_MS = 450;
const SOLVED_HOLD_MS = 1500;
const FADE_MS = 300;

export const CONNECTING_SCRIPTS = [
  { answer: 'termo', guesses: ['porta', 'temor', 'termo'] },
  { answer: 'jogar', guesses: ['salto', 'molar', 'jogar'] },
  { answer: 'praia', guesses: ['forte', 'prato', 'praia'] },
];

export type AnimationPhase = 'typing' | 'revealing' | 'solved' | 'clearing';

export interface AnimationState {
  script: number;
  row: number;
  typed: number;
  phase: AnimationPhase;
}

export const INITIAL_STATE: AnimationState = {
  script: 0,
  row: 0,
  typed: 0,
  phase: 'typing',
};

export function next(state: AnimationState): AnimationState {
  const { guesses, answer } = CONNECTING_SCRIPTS[state.script];
  switch (state.phase) {
    case 'typing':
      return state.typed < WORD_LENGTH
        ? { ...state, typed: state.typed + 1 }
        : { ...state, phase: 'revealing' };
    case 'revealing':
      return guesses[state.row] === answer
        ? { ...state, phase: 'solved' }
        : { ...state, row: state.row + 1, typed: 0, phase: 'typing' };
    case 'solved':
      return { ...state, phase: 'clearing' };
    case 'clearing':
      return {
        ...INITIAL_STATE,
        script: (state.script + 1) % CONNECTING_SCRIPTS.length,
      };
  }
}

// How long a frame stays on screen before `next` replaces it.
export function frameMs(
  state: AnimationState,
  random: () => number = Math.random,
): number {
  switch (state.phase) {
    case 'typing':
      return state.typed < WORD_LENGTH
        ? 110 + Math.round(random() * 70)
        : SUBMIT_PAUSE_MS;
    case 'revealing':
      return revealDurationMs(WORD_LENGTH);
    case 'solved':
      return (
        (WORD_LENGTH - 1) * BOUNCE_STAGGER_MS +
        BOUNCE_DURATION_MS +
        SOLVED_HOLD_MS
      );
    case 'clearing':
      return FADE_MS;
  }
}
