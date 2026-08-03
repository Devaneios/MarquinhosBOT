import type { GameMode } from './types';

export function ModeMenu({
  onSelect,
  onBack,
}: {
  onSelect: (mode: GameMode) => void;
  onBack: () => void;
}) {
  return (
    <div className="pong-screen pong-mode-select">
      <div className="pong-heading pong-screen-title">SELECT MODE</div>
      <div className="pong-mode-select-options">
        <button
          type="button"
          className="pong-mode-card pong-mode-card-red"
          onClick={() => onSelect('single')}
        >
          <div className="pong-heading pong-mode-card-title">1 PLAYER</div>
          <div className="pong-mode-card-subtitle">VS CPU</div>
        </button>
        <button
          type="button"
          className="pong-mode-card pong-mode-card-green"
          onClick={() => onSelect('multi')}
        >
          <div className="pong-heading pong-mode-card-title">2 PLAYERS</div>
          <div className="pong-mode-card-subtitle">VS FRIEND</div>
        </button>
        <button
          type="button"
          className="pong-mode-card pong-mode-card-yellow"
          onClick={() => onSelect('local')}
        >
          <div className="pong-heading pong-mode-card-title">LOCAL 2P</div>
          <div className="pong-mode-card-subtitle">SAME DEVICE</div>
        </button>
      </div>
      <button type="button" className="pong-btn-back" onClick={onBack}>
        &lt; BACK
      </button>
    </div>
  );
}
