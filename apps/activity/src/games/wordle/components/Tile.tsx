import { FEEDBACK_COLORS } from '@/games/shared/letterFeedback';
import { cn } from '@/shared/utils/cn';
import type { LetterFeedback } from '@marquinhos/contracts/wordle';
import type { CSSProperties } from 'react';

export type TileMotion = {
  kind: 'flip' | 'bounce';
  delayMs: number;
  durationMs: number;
};

export function Tile({
  letter,
  feedback,
  size = 'sm',
  order,
  motion,
}: {
  letter: string;
  feedback?: LetterFeedback;
  size?: 'sm' | 'lg';
  order: number;
  motion?: TileMotion;
}) {
  const colors = feedback ? FEEDBACK_COLORS[feedback] : null;
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-md border font-pixel font-bold uppercase',
        'termo-tile',
        motion?.kind === 'flip' && 'termo-flip',
        motion?.kind === 'bounce' && 'termo-bounce',
        size === 'lg'
          ? 'h-16 w-16 text-2xl sm:h-20 sm:w-20 sm:text-3xl'
          : 'h-11 w-11 text-lg sm:h-12 sm:w-12',
        colors
          ? 'border-transparent'
          : letter
            ? 'border-marquinhos-border-hover'
            : 'border-marquinhos-border/60',
      )}
      style={
        {
          '--order': order,
          ...(colors && {
            '--tile-bg': colors.bg,
            '--tile-fg': colors.text,
            backgroundColor: colors.bg,
            color: colors.text,
          }),
          ...(motion && {
            animationDelay: `${motion.delayMs}ms`,
            animationDuration: `${motion.durationMs}ms`,
          }),
        } as CSSProperties
      }
    >
      {letter}
    </div>
  );
}
