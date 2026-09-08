import { useTranslation } from 'react-i18next';
import type { GameDescriptor } from '../games/registry';
import { GamePreview } from './GamePreview';
import { PlayGameLink } from './PlayGameLink';

export function GameCard({ game }: { game: GameDescriptor }) {
  const { t } = useTranslation('games');

  return (
    <article
      aria-labelledby={`card-${game.id}`}
      className="relative isolate flex min-w-0 flex-col gap-5 p-5"
    >
      <div
        aria-hidden="true"
        className="notch-8 pointer-events-none absolute inset-0 -z-10 border border-marquinhos-border bg-marquinhos-panel"
      />
      <GamePreview gameId={game.id} compact />
      <div className="space-y-3">
        <h3
          id={`card-${game.id}`}
          className="font-pixel text-sm leading-relaxed break-words"
        >
          {t(`${game.id}.name`)}
        </h3>
        <p className="text-sm leading-6 text-marquinhos-text-dim">
          {t(`${game.id}.blurb`)}
        </p>
      </div>
      <div className="mt-auto pt-1">
        <PlayGameLink gameId={game.id} />
      </div>
    </article>
  );
}
