export function MainMenu({
  onPlay,
  onSettings,
  onHowTo,
}: {
  onPlay: () => void;
  onSettings: () => void;
  onHowTo: () => void;
}) {
  return (
    <div className="pong-screen pong-main-menu">
      <div className="pong-main-menu-title">
        <div className="pong-heading pong-logo">PONGUINHOS</div>
        <div className="pong-heading pong-blink-text">PRESS PLAY TO START</div>
      </div>
      <div className="pong-main-menu-actions">
        <button
          type="button"
          className="pong-btn pong-btn-primary"
          onClick={onPlay}
        >
          PLAY
        </button>
        <button
          type="button"
          className="pong-btn pong-btn-secondary"
          onClick={onSettings}
        >
          SETTINGS
        </button>
        <button
          type="button"
          className="pong-btn pong-btn-secondary"
          onClick={onHowTo}
        >
          HOW TO PLAY
        </button>
      </div>
      <div className="pong-main-menu-footer">© 2026 ARCADE PIXEL STUDIOS</div>
    </div>
  );
}
