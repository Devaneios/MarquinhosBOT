import type { GuessRow as GuessRowData } from '@marquinhos/contracts/wordle';
import {
  BOUNCE_DURATION_MS,
  BOUNCE_STAGGER_MS,
  FLIP_DURATION_MS,
  FLIP_STAGGER_MS,
} from '../constants';
import { Tile, type TileMotion } from './Tile';

function tileMotion(
  motion: 'flip' | 'bounce' | undefined,
  index: number,
): TileMotion | undefined {
  if (motion === 'flip')
    return {
      kind: 'flip',
      delayMs: index * FLIP_STAGGER_MS,
      durationMs: FLIP_DURATION_MS,
    };
  if (motion === 'bounce')
    return {
      kind: 'bounce',
      delayMs: index * BOUNCE_STAGGER_MS,
      durationMs: BOUNCE_DURATION_MS,
    };
  return undefined;
}

export function GuessRow({
  row,
  rowIndex,
  motion,
}: {
  row: GuessRowData;
  rowIndex: number;
  motion?: 'flip' | 'bounce';
}) {
  return (
    <div className="flex gap-1.5 sm:gap-2">
      {row.guess.split('').map((letter, index) => (
        <Tile
          key={index}
          letter={letter.toUpperCase()}
          feedback={row.feedback[index]}
          order={rowIndex * row.guess.length + index}
          motion={tileMotion(motion, index)}
        />
      ))}
    </div>
  );
}
