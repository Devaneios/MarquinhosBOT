import { useTranslation } from 'react-i18next';
import { MenuPanel, MenuScreen } from '../../../components/game-shell';
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
  'notch-4 flex-1 cursor-pointer border py-3 text-center font-pixel text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent motion-safe:transition-colors';
const optionBtnOn =
  'border-marquinhos-accent bg-marquinhos-accent text-marquinhos-bg';
const optionBtnOff =
  'border-marquinhos-border bg-transparent text-marquinhos-text hover:border-marquinhos-accent hover:text-marquinhos-accent';
const fieldLabel = 'font-pixel text-sm text-marquinhos-text';
const selectClass =
  'mt-3 w-full cursor-pointer rounded-sm border border-marquinhos-border bg-marquinhos-bg px-3 py-3 font-mono text-sm text-marquinhos-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent';

function Toggle({
  id,
  checked,
  disabled = false,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'notch-4 relative h-9 w-[90px] cursor-pointer border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent disabled:cursor-not-allowed disabled:opacity-40',
        checked
          ? 'border-marquinhos-green bg-marquinhos-green/20'
          : 'border-marquinhos-border bg-marquinhos-bg',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-[26px] w-[26px] transition-[left] duration-150',
          checked
            ? 'left-[54px] bg-marquinhos-green'
            : 'left-0.5 bg-marquinhos-text-disabled',
        )}
      />
    </button>
  );
}

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
    <MenuScreen
      titleKey="pong.name"
      titleNs="games"
      headingKey="settings"
      headingNs="common"
      onBack={onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <MenuPanel className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="sound-toggle" className={fieldLabel}>
              {t('soundLabel')}
            </label>
            <Toggle
              id="sound-toggle"
              checked={sound}
              onChange={onSoundChange}
            />
          </div>
          <p className="mt-3 text-sm leading-6 text-marquinhos-text-dim">
            {t('soundDescription')}
          </p>
        </MenuPanel>

        <MenuPanel className="p-5 sm:p-6">
          <div className={fieldLabel}>{t('difficultyLabel')}</div>
          <div className="mt-3 flex gap-2.5">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={difficulty === d}
                onClick={() => onDifficultyChange(d)}
                className={cn(
                  optionBtnBase,
                  difficulty === d ? optionBtnOn : optionBtnOff,
                )}
              >
                {t(DIFFICULTY_LABEL_KEY[d])}
              </button>
            ))}
          </div>
        </MenuPanel>

        <MenuPanel className="p-5 sm:p-6 lg:col-span-2">
          <div className={fieldLabel}>{t('winScoreLabel')}</div>
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
                  winScore === w ? optionBtnOn : optionBtnOff,
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </MenuPanel>

        <MenuPanel className="p-5 sm:p-6 lg:col-span-2">
          <label htmlFor="pong-ruleset" className={fieldLabel}>
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
            className={selectClass}
          >
            {RULESETS.map((value) => (
              <option key={value} value={value}>
                {t(`rulesets.${value}`)}
              </option>
            ))}
          </select>
        </MenuPanel>

        <MenuPanel className="p-5 sm:p-6">
          <div className={fieldLabel}>{t('bestOfLabel')}</div>
          <div className="mt-3 flex gap-2.5">
            {BEST_OF.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={bestOf === value}
                onClick={() => onBestOfChange(value)}
                className={cn(
                  optionBtnBase,
                  bestOf === value ? optionBtnOn : optionBtnOff,
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </MenuPanel>

        <MenuPanel className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="ranked-toggle" className={fieldLabel}>
              {t('rankedLabel')}
            </label>
            <Toggle
              id="ranked-toggle"
              checked={ranked}
              disabled={
                ruleset !== 'classic-1v1' && ruleset !== 'quad-elimination'
              }
              onChange={onRankedChange}
            />
          </div>
        </MenuPanel>
      </div>
    </MenuScreen>
  );
}
