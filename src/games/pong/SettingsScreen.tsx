import { cn } from '../../lib/cn';
import type { BotDifficulty, WinScore } from './types';

const DIFFICULTIES: BotDifficulty[] = ['easy', 'normal', 'hard'];
const WIN_SCORES: WinScore[] = [5, 11, 21];

const optionBtnBase =
  'notch-6 flex-1 cursor-pointer border py-3 text-center font-pixel text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent';

export function SettingsScreen({
  difficulty,
  onDifficultyChange,
  sound,
  onSoundChange,
  winScore,
  onWinScoreChange,
  onBack,
}: {
  difficulty: BotDifficulty;
  onDifficultyChange: (difficulty: BotDifficulty) => void;
  sound: boolean;
  onSoundChange: (sound: boolean) => void;
  winScore: WinScore;
  onWinScoreChange: (winScore: WinScore) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <div className="notch-8 flex w-full max-w-[760px] flex-col gap-6 border border-marquinhos-border bg-marquinhos-panel px-6 py-8 shadow-[0_20px_40px_rgba(0,0,0,0.24)] sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="font-pixel text-2xl tracking-[0.24em] text-marquinhos-text">
            SETTINGS
          </div>
          <button
            type="button"
            className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
            onClick={onBack}
          >
            Back
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="notch-6 border border-marquinhos-border bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="sound-toggle"
                className="font-pixel text-sm text-marquinhos-text"
              >
                SOUND
              </label>
              <button
                type="button"
                id="sound-toggle"
                role="switch"
                aria-checked={sound}
                onClick={() => onSoundChange(!sound)}
                className={cn(
                  'relative h-9 w-[90px] cursor-pointer border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent',
                  sound
                    ? 'border-marquinhos-green bg-marquinhos-green/20'
                    : 'border-marquinhos-border bg-marquinhos-panel',
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 h-[26px] w-[26px] transition-[left] duration-150',
                    sound
                      ? 'left-[54px] bg-marquinhos-green'
                      : 'left-0.5 bg-marquinhos-text-disabled',
                  )}
                />
              </button>
            </div>
            <div className="mt-3 text-sm leading-6 text-marquinhos-text-dim">
              Audio cues and feedback effects for the arcade experience.
            </div>
          </div>

          <div className="notch-6 border border-marquinhos-border bg-black/20 p-4">
            <div className="font-pixel text-sm text-marquinhos-text">
              DIFFICULTY
            </div>
            <div className="mt-3 flex gap-2.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={difficulty === d}
                  onClick={() => onDifficultyChange(d)}
                  className={cn(
                    optionBtnBase,
                    difficulty === d
                      ? 'border-marquinhos-accent bg-marquinhos-accent text-marquinhos-bg'
                      : 'border-marquinhos-border bg-transparent text-marquinhos-text hover:border-marquinhos-border-hover',
                  )}
                >
                  {d.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="notch-6 border border-marquinhos-border bg-black/20 p-4 lg:col-span-2">
            <div className="font-pixel text-sm text-marquinhos-text">
              SCORE TO WIN
            </div>
            <div className="mt-3 flex gap-2.5">
              {WIN_SCORES.map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={winScore === w}
                  onClick={() => onWinScoreChange(w)}
                  className={cn(
                    optionBtnBase,
                    'text-sm',
                    winScore === w
                      ? 'border-marquinhos-accent bg-marquinhos-accent text-marquinhos-bg'
                      : 'border-marquinhos-border bg-transparent text-marquinhos-text hover:border-marquinhos-border-hover',
                  )}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
