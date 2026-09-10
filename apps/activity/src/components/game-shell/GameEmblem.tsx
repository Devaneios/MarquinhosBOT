import { useTranslation } from 'react-i18next';
import type { GameId } from '../../games/gameId';
import { cn } from '../../lib/cn';

export interface GameEmblemProps {
  gameId: GameId;
  compact?: boolean;
}

// The Hub preview tile, reduced to what every game can supply: a dotted
// arcade plate with the game's two-letter monogram. Decorative — the game's
// name is always spelled out next to it.
export function GameEmblem({ gameId, compact = false }: GameEmblemProps) {
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
      <span className="notch-6 flex h-20 w-20 items-center justify-center border border-marquinhos-accent/30 bg-marquinhos-bg font-pixel text-2xl text-marquinhos-accent">
        {t(`${gameId}.name`).slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}
