import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/cn';
import type { BestOf, BotDifficulty, PongRulesetId, WinScore } from '../types';

const DIFFICULTIES: BotDifficulty[] = ['easy', 'normal', 'hard'];
const WIN_SCORES: WinScore[] = [7, 10, 11, 15, 21];
const BEST_OF: BestOf[] = [1, 3, 5];
const RULESETS: PongRulesetId[] = [
  'classic-1v1',
  'doubles-2v2',
  'quad-elimination',
  'superpong',
  'rebound',
  'breakout',
  'brick-battle',
  'multiball',
  'powerup-battle',
  'radial-solo',
  'radial-duel',
  'pong-tennis',
  'air-hockey',
  'coop-keep-alive',
];

const DIFFICULTY_LABEL_KEY: Record<BotDifficulty, string> = {
  easy: 'difficultyEasy',
  normal: 'difficultyNormal',
  hard: 'difficultyHard',
};

const optionBtnBase =
  'notch-6 flex-1 cursor-pointer border py-3 text-center font-pixel text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent';

export function SettingsScreen({
  difficulty,
  onDifficultyChange,
  sound,
  onSoundChange,
  winScore,
  onWinScoreChange,
  ruleset,
  onRulesetChange,
  bestOf,
  onBestOfChange,
  ranked,
  onRankedChange,
  onBack,
}: {
  difficulty: BotDifficulty;
  onDifficultyChange: (difficulty: BotDifficulty) => void;
  sound: boolean;
  onSoundChange: (sound: boolean) => void;
  winScore: WinScore;
  onWinScoreChange: (winScore: WinScore) => void;
  ruleset: PongRulesetId;
  onRulesetChange: (ruleset: PongRulesetId) => void;
  bestOf: BestOf;
  onBestOfChange: (bestOf: BestOf) => void;
  ranked: boolean;
  onRankedChange: (ranked: boolean) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation(['pong', 'common']);

  return (
    <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      <div className="notch-8 my-auto flex w-full max-w-[760px] flex-col gap-4 border border-marquinhos-border bg-marquinhos-panel px-4 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.24)] sm:gap-6 sm:px-8 sm:py-8">
        <div className="flex items-start justify-between gap-4">
          <div className="font-pixel min-w-0 text-lg tracking-[0.12em] text-marquinhos-text sm:text-2xl sm:tracking-[0.24em]">
            {t('common:settings')}
          </div>
          <button
            type="button"
            className="notch-6 shrink-0 border border-marquinhos-border bg-marquinhos-bg px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent sm:px-4 sm:text-xs sm:tracking-[0.2em]"
            onClick={onBack}
          >
            {t('common:back')}
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="notch-6 border border-marquinhos-border bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="sound-toggle"
                className="font-pixel text-sm text-marquinhos-text"
              >
                {t('soundLabel')}
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
              {t('soundDescription')}
            </div>
          </div>

          <div className="notch-6 border border-marquinhos-border bg-black/20 p-4">
            <div className="font-pixel text-sm text-marquinhos-text">
              {t('difficultyLabel')}
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
                  {t(DIFFICULTY_LABEL_KEY[d])}
                </button>
              ))}
            </div>
          </div>

          <div className="notch-6 border border-marquinhos-border bg-black/20 p-4 lg:col-span-2">
            <div className="font-pixel text-sm text-marquinhos-text">
              {t('winScoreLabel')}
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

          <div className="notch-6 border border-marquinhos-border bg-black/20 p-4 lg:col-span-2">
            <label
              htmlFor="pong-ruleset"
              className="font-pixel text-sm text-marquinhos-text"
            >
              {t('rulesetLabel')}
            </label>
            <select
              id="pong-ruleset"
              value={ruleset}
              onChange={(event) => {
                const value = event.target.value as PongRulesetId;
                onRulesetChange(value);
                if (
                  ranked &&
                  value !== 'classic-1v1' &&
                  value !== 'quad-elimination'
                ) {
                  onRankedChange(false);
                }
              }}
              className="mt-3 w-full border border-marquinhos-border bg-marquinhos-bg px-3 py-3 font-mono text-sm text-marquinhos-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
            >
              {RULESETS.map((value) => (
                <option key={value} value={value}>
                  {t(`rulesets.${value}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="notch-6 border border-marquinhos-border bg-black/20 p-4">
            <div className="font-pixel text-sm text-marquinhos-text">
              {t('bestOfLabel')}
            </div>
            <div className="mt-3 flex gap-2.5">
              {BEST_OF.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={bestOf === value}
                  onClick={() => onBestOfChange(value)}
                  className={cn(
                    optionBtnBase,
                    bestOf === value
                      ? 'border-marquinhos-accent bg-marquinhos-accent text-marquinhos-bg'
                      : 'border-marquinhos-border bg-transparent text-marquinhos-text hover:border-marquinhos-border-hover',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="notch-6 border border-marquinhos-border bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="ranked-toggle"
                className="font-pixel text-sm text-marquinhos-text"
              >
                {t('rankedLabel')}
              </label>
              <button
                type="button"
                id="ranked-toggle"
                role="switch"
                aria-checked={ranked}
                disabled={
                  ruleset !== 'classic-1v1' && ruleset !== 'quad-elimination'
                }
                onClick={() => onRankedChange(!ranked)}
                className={cn(
                  'relative h-9 w-[90px] cursor-pointer border disabled:cursor-not-allowed disabled:opacity-40',
                  ranked
                    ? 'border-marquinhos-green bg-marquinhos-green/20'
                    : 'border-marquinhos-border bg-marquinhos-panel',
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 h-[26px] w-[26px] transition-[left] duration-150',
                    ranked
                      ? 'left-[54px] bg-marquinhos-green'
                      : 'left-0.5 bg-marquinhos-text-disabled',
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
