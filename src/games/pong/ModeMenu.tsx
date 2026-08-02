import type { GameMode } from '../../hooks/useDiscordAuth';

export function ModeMenu({ onSelect }: { onSelect: (mode: GameMode) => void }) {
  return (
    <div className="mode-menu">
      <h2>Choose a mode</h2>
      <div className="mode-menu-options">
        <button type="button" onClick={() => onSelect('single')}>
          Single Player
        </button>
        <button type="button" onClick={() => onSelect('multi')}>
          Multiplayer
        </button>
      </div>
    </div>
  );
}
