export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <div className="pong-screen pong-how-to">
      <div className="pong-heading pong-screen-title">HOW TO PLAY</div>
      <div className="pong-how-to-players">
        <div className="pong-how-to-player">
          <div className="pong-heading pong-how-to-player-name pong-how-to-player-name-red">
            PLAYER 1
          </div>
          <div className="pong-how-to-controls">
            <div className="pong-heading pong-how-to-key">W</div>
            <div className="pong-heading pong-how-to-key">S</div>
          </div>
          <div className="pong-how-to-hint">MOVE UP / DOWN</div>
        </div>
        <div className="pong-how-to-player">
          <div className="pong-heading pong-how-to-player-name pong-how-to-player-name-green">
            PLAYER 2
          </div>
          <div className="pong-how-to-controls">
            <div className="pong-heading pong-how-to-key">▲</div>
            <div className="pong-heading pong-how-to-key">▼</div>
          </div>
          <div className="pong-how-to-hint">MOVE UP / DOWN</div>
        </div>
      </div>
      <div className="pong-how-to-note">
        VS CPU OR VS FRIEND USES ARROW KEYS ONLY. FIRST TO REACH THE TARGET
        SCORE WINS. PRESS ESC TO PAUSE MID-MATCH.
      </div>
      <button type="button" className="pong-btn-back" onClick={onBack}>
        &lt; BACK
      </button>
    </div>
  );
}
