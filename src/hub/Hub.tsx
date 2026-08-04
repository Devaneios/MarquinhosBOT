import { useState } from 'react';
import type { GameId } from '../games/gameId';
import { PongGame } from '../games/pong/PongGame';
import type { DiscordIdentity } from '../hooks/useDiscordIdentity';
import { cn } from '../lib/cn';

interface ArcadeTile {
  id: GameId | null;
  name: string;
  status: string;
  locked: boolean;
}

const TILES: ArcadeTile[] = [
  { id: 'pong', name: 'PONGUINHOS', status: 'PLAY', locked: false },
  { id: null, name: 'BREAKOUT', status: 'COMING SOON', locked: true },
  { id: null, name: 'SNAKE', status: 'COMING SOON', locked: true },
];

export function Hub({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  if (activeGame === 'pong') {
    return (
      <PongGame
        identity={identity}
        onAuthInvalid={onAuthInvalid}
        onExit={() => setActiveGame(null)}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-11 p-7">
      <div className="font-pixel animate-pixel-glow text-4xl tracking-widest text-marquinhos-accent">
        MARQUINHOS
      </div>
      <div className="flex max-w-[760px] flex-wrap justify-center gap-6">
        {TILES.map((tile) => (
          <button
            key={tile.name}
            type="button"
            disabled={tile.locked}
            className={cn(
              'notch-8 flex w-[220px] flex-col items-center gap-3.5 border border-marquinhos-border bg-marquinhos-panel px-4.5 py-7 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent',
              tile.locked
                ? 'cursor-not-allowed'
                : 'cursor-pointer hover:border-marquinhos-border-hover',
            )}
            onClick={() => {
              if (!tile.id) return;
              console.log('[hub] launching game', tile.id);
              setActiveGame(tile.id);
            }}
          >
            <div
              className={cn(
                'font-mono text-sm font-semibold tracking-wide',
                tile.locked
                  ? 'text-marquinhos-text-disabled'
                  : 'text-marquinhos-text',
              )}
            >
              {tile.name}
            </div>
            <div className="text-sm text-marquinhos-text-dim">
              {tile.status}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
