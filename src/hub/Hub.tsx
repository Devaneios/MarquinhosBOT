import { useState } from 'react';
import type { GameId } from '../games/gameId';
import { PongGame } from '../games/pong/PongGame';
import type { DiscordIdentity } from '../hooks/useDiscordIdentity';

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
    <div className="pong-screen pong-hub">
      <div className="pong-heading pong-logo">MARQUINHOS</div>
      <div className="pong-hub-grid">
        {TILES.map((tile) => (
          <button
            key={tile.name}
            type="button"
            disabled={tile.locked}
            className={`pong-hub-tile${tile.locked ? ' pong-hub-tile-locked' : ''}`}
            onClick={() => {
              if (!tile.id) return;
              console.log('[hub] launching game', tile.id);
              setActiveGame(tile.id);
            }}
          >
            <div className="pong-heading pong-hub-tile-name">{tile.name}</div>
            <div className="pong-hub-tile-status">{tile.status}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
