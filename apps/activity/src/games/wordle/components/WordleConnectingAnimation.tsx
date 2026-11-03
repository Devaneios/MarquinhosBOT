import { prefersReducedMotion } from '@/shared/motion/transitions';
import { cn } from '@/shared/utils/cn';
import { computeFeedback } from '@marquinhos/domain/games/wordle/feedback';
import { useEffect, useState } from 'react';
import {
  CONNECTING_SCRIPTS,
  INITIAL_STATE,
  ROWS,
  WORD_LENGTH,
  frameMs,
  next,
  type AnimationState,
} from '../connectingTimeline';
import { GuessRow } from './GuessRow';
import { Tile } from './Tile';

const SOLVED_STILL: AnimationState = {
  script: 0,
  row: CONNECTING_SCRIPTS[0].guesses.length - 1,
  typed: WORD_LENGTH,
  phase: 'solved',
};

function BoardRow({
  state,
  rowIndex,
}: {
  state: AnimationState;
  rowIndex: number;
}) {
  const { guesses, answer } = CONNECTING_SCRIPTS[state.script];
  const guess = guesses[rowIndex] ?? '';
  const submitted =
    rowIndex < state.row ||
    (rowIndex === state.row && state.phase !== 'typing');

  if (submitted) {
    const motion =
      rowIndex !== state.row
        ? undefined
        : state.phase === 'revealing'
          ? 'flip'
          : 'bounce';
    return (
      <GuessRow
        row={{ guess, feedback: computeFeedback(guess, answer) }}
        rowIndex={rowIndex}
        motion={motion}
      />
    );
  }

  const typing = rowIndex === state.row;
  return (
    <div className="flex gap-1.5 sm:gap-2">
      {Array.from({ length: WORD_LENGTH }, (_, index) => {
        const letter = typing && index < state.typed ? guess[index] : '';
        return (
          <Tile
            key={index}
            letter={letter.toUpperCase()}
            order={rowIndex * WORD_LENGTH + index}
            className={cn(
              letter && 'termo-pop',
              typing &&
                index === state.typed &&
                'border-marquinhos-accent ring-2 ring-inset ring-marquinhos-accent',
            )}
          />
        );
      })}
    </div>
  );
}

export function WordleConnectingAnimation() {
  const [still] = useState(prefersReducedMotion);
  const [state, setState] = useState(still ? SOLVED_STILL : INITIAL_STATE);

  useEffect(() => {
    if (still) return;
    const timer = setTimeout(() => setState(next(state)), frameMs(state));
    return () => clearTimeout(timer);
  }, [state, still]);

  return (
    <div
      className={cn(
        'mx-auto flex w-fit flex-col gap-1.5 transition-opacity duration-300 sm:gap-2',
        state.phase === 'clearing' && 'opacity-0',
      )}
    >
      {Array.from({ length: ROWS }, (_, rowIndex) => (
        <BoardRow key={rowIndex} state={state} rowIndex={rowIndex} />
      ))}
    </div>
  );
}
