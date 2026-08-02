import { useState } from 'react';
import type { GameId } from '../games/gameId';
import { PongGame } from '../games/pong/PongGame';
import type { DiscordIdentity } from '../hooks/useDiscordIdentity';

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
    <div className="pong-screen pong-main-menu">
      <div className="pong-main-menu-title">
        <div className="pong-heading pong-logo">MARQUINHOS</div>
        <div className="pong-heading pong-blink-text">CHOOSE A GAME</div>
      </div>
      <div className="pong-main-menu-actions">
        <button
          type="button"
          className="pong-btn pong-btn-primary"
          onClick={() => setActiveGame('pong')}
        >
          PONG
        </button>
      </div>
    </div>
  );
}
