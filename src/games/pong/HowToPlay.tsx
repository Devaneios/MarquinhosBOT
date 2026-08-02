export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <div className="pong-screen pong-how-to">
      <div className="pong-heading pong-screen-title">HOW TO PLAY</div>
      <div className="pong-how-to-controls">
        <div className="pong-heading pong-how-to-key">▲</div>
        <div className="pong-heading pong-how-to-key">▼</div>
      </div>
      <div className="pong-how-to-hint">MOVE YOUR PADDLE UP / DOWN</div>
      <div className="pong-how-to-note">
        FIRST TO REACH THE TARGET SCORE WINS THE MATCH.
      </div>
      <button type="button" className="pong-btn-back" onClick={onBack}>
        &lt; BACK
      </button>
    </div>
  );
}
