import { cn } from '../../../lib/cn';
import { FEEDBACK_COLORS } from '../constants';
import type { LetterFeedback } from '../types';

export function Tile({
  letter,
  feedback,
}: {
  letter: string;
  feedback?: LetterFeedback;
}) {
  const colors = feedback ? FEEDBACK_COLORS[feedback] : null;
  return (
    <div
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-md border font-pixel text-lg font-bold uppercase sm:h-12 sm:w-12',
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
