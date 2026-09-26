import { FEEDBACK_COLORS } from '@/games/shared/letterFeedback';
import { cn } from '@/shared/utils/cn';
import type { LetterFeedback } from '@marquinhos/contracts/wordle';

export function Tile({
  letter,
  feedback,
  size = 'sm',
}: {
  letter: string;
  feedback?: LetterFeedback;
  size?: 'sm' | 'lg';
}) {
  const colors = feedback ? FEEDBACK_COLORS[feedback] : null;
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-md border font-pixel font-bold uppercase',
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
        colors ? { backgroundColor: colors.bg, color: colors.text } : undefined
      }
    >
      {letter}
    </div>
  );
}
