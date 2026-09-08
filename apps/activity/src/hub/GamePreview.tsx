import { useTranslation } from 'react-i18next';
import type { GameId } from '../games/gameId';
import { FEEDBACK_COLORS } from '../games/wordle/constants';
import { cn } from '../lib/cn';

const WORDLE_PREVIEW = [
  {
    word: 'LIVRO',
    feedback: ['absent', 'absent', 'absent', 'present', 'correct'],
  },
  {
    word: 'TERMO',
    feedback: ['correct', 'correct', 'correct', 'correct', 'correct'],
  },
] as const;

function WordlePreview({ compact }: { compact: boolean }) {
  const { t } = useTranslation('games');

  return (
    <div className={cn('w-full', compact ? 'max-w-40' : 'max-w-72')}>
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {WORDLE_PREVIEW.flatMap(({ word, feedback }, row) =>
          [...word].map((letter, column) => {
            const colors = FEEDBACK_COLORS[feedback[column]];
            return (
              <span
                key={`${row}-${column}`}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-sm border border-white/10 font-pixel shadow-[0_3px_0_rgba(0,0,0,0.18)]',
                  compact ? 'text-xs' : 'text-lg sm:text-xl',
                )}
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                {letter}
              </span>
            );
          }),
        )}
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={`empty-${index}`}
            className="aspect-square rounded-sm border border-marquinhos-border/70 bg-marquinhos-bg/30"
          />
        ))}
      </div>
      {!compact && (
        <p className="mt-5 text-center text-xs leading-relaxed text-marquinhos-text-dim">
          {t('wordle.previewCaption')}
        </p>
      )}
    </div>
  );
}

export function GamePreview({
  gameId,
  compact = false,
}: {
  gameId: GameId;
  compact?: boolean;
}) {
  const { t } = useTranslation('games');

  return (
    <div
      aria-hidden="true"
      className={cn(
        'notch-8 flex w-full items-center justify-center bg-[radial-gradient(circle,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-size-[12px_12px]',
        compact
          ? 'h-40 bg-marquinhos-bg/50 p-4'
          : 'min-h-64 bg-marquinhos-bg/40 px-4 py-7 sm:min-h-80 sm:px-6 md:py-10 [@media(max-height:600px)]:min-h-0 [@media(max-height:600px)]:py-5',
      )}
    >
      {gameId === 'wordle' ? (
        <WordlePreview compact={compact} />
      ) : (
        <span className="notch-6 flex h-20 w-20 items-center justify-center border border-marquinhos-accent/30 bg-marquinhos-bg font-pixel text-2xl text-marquinhos-accent">
          {t(`${gameId}.name`).slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}
