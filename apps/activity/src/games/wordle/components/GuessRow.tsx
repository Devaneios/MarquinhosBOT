import type { GuessRow as GuessRowData } from '../types';
import { Tile } from './Tile';

export function GuessRow({ row }: { row: GuessRowData }) {
  return (
    <div className="flex gap-1.5 sm:gap-2">
      {row.guess.split('').map((letter, index) => (
        <Tile
          key={index}
          letter={letter.toUpperCase()}
          feedback={row.feedback[index]}
        />
      ))}
    </div>
  );
}
