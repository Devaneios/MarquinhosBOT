import { useState } from 'react';
import type { BotDifficulty } from './types';

const DIFFICULTIES: BotDifficulty[] = ['easy', 'normal', 'hard'];
const WIN_SCORES = [5, 11, 21] as const;

export function SettingsScreen({
  difficulty,
  onDifficultyChange,
  onBack,
}: {
  difficulty: BotDifficulty;
  onDifficultyChange: (difficulty: BotDifficulty) => void;
  onBack: () => void;
}) {
  const [sound, setSound] = useState(true);
  const [winScore, setWinScore] = useState<(typeof WIN_SCORES)[number]>(11);

  return (
    <div className="pong-screen pong-settings">
      <div className="pong-heading pong-screen-title">SETTINGS</div>
      <div className="pong-settings-body">
        <div className="pong-settings-row">
          <label
            htmlFor="sound-toggle"
            className="pong-heading pong-settings-label"
          >
            SOUND
          </label>
          <button
            type="button"
            id="sound-toggle"
            role="switch"
            aria-checked={sound}
            onClick={() => setSound((v) => !v)}
            className="pong-toggle"
            style={{ background: sound ? '#2f9e64' : '#2a2732' }}
          >
            <div
              className="pong-toggle-knob"
              style={{ left: sound ? '54px' : '2px' }}
            />
          </button>
        </div>

        <div className="pong-settings-group">
          <div className="pong-heading pong-settings-label">DIFFICULTY</div>
          <div className="pong-settings-options">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={difficulty === d}
                onClick={() => onDifficultyChange(d)}
                className={`pong-option-btn${difficulty === d ? ' pong-option-btn-active' : ''}`}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="pong-settings-group">
          <div className="pong-heading pong-settings-label">SCORE TO WIN</div>
          <div className="pong-settings-options">
            {WIN_SCORES.map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={winScore === w}
                onClick={() => setWinScore(w)}
                className={`pong-option-btn pong-option-btn-large${winScore === w ? ' pong-option-btn-active' : ''}`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button type="button" className="pong-btn-back" onClick={onBack}>
        &lt; BACK
      </button>
    </div>
  );
}
