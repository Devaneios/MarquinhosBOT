import { useTranslation } from 'react-i18next';
import type { GameDescriptor } from '../games/registry';
import { FEEDBACK_COLORS } from '../games/wordle/constants';
import { GamePreview } from './GamePreview';
import { PlayGameLink } from './PlayGameLink';

export function FeaturedGame({ game }: { game: GameDescriptor }) {
  const { t } = useTranslation(['common', 'games']);

  return (
    <section
      aria-labelledby={`featured-${game.id}`}
      className="relative isolate grid md:grid-cols-[1.1fr_1fr]"
    >
      <div
        aria-hidden="true"
        className="notch-8 pointer-events-none absolute inset-0 -z-10 border border-marquinhos-border bg-marquinhos-panel"
      />

      <div className="flex min-w-0 flex-col items-start gap-6 p-5 sm:p-8 lg:p-10 [@media(max-height:600px)]:gap-4 [@media(max-height:600px)]:py-5">
        <div className="flex flex-wrap items-center gap-3 text-xs leading-relaxed">
          <span className="inline-flex items-center gap-2 font-semibold text-marquinhos-accent">
            <span aria-hidden="true" className="h-1.5 w-1.5 bg-current" />
            {t('common:hub.featured')}
          </span>
          {game.id === 'wordle' && (
            <span className="border-l border-marquinhos-border pl-3 text-marquinhos-text-dim">
              {t('games:wordle.category')}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <h2
            id={`featured-${game.id}`}
            className="font-pixel text-xl leading-relaxed break-words lg:text-[28px]"
          >
            {t(`games:${game.id}.name`)}
          </h2>
          <p className="max-w-96 text-sm leading-7 text-marquinhos-text-dim sm:text-base">
            {t(`games:${game.id}.blurb`)}
          </p>
        </div>

        {game.id === 'wordle' && (
          <ul className="flex flex-col gap-2.5 text-xs leading-relaxed text-marquinhos-text-dim">
            {(['correct', 'present', 'absent'] as const).map((feedback) => (
              <li key={feedback} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-xs border border-white/15"
                  style={{ backgroundColor: FEEDBACK_COLORS[feedback].bg }}
                />
                {t(`games:wordle.hints.${feedback}`)}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto w-full pt-1 sm:w-auto">
          <PlayGameLink gameId={game.id} featured />
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-center px-5 pb-6 sm:px-8 md:py-8 lg:p-10 [@media(max-height:600px)]:py-5">
        <GamePreview gameId={game.id} />
      </div>
    </section>
  );
}
