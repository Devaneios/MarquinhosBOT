import { Keyboard } from '@/games/shared/keyboard';
import type { WsSession } from '@/games/shared/session/gameSession';
import { backChipClass, GameHeader } from '@/games/shared/shell';
import type { WordleUserConfig } from '@marquinhos/contracts/wordle';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  buildKeyboardRows,
  FEEDBACK_COLORS,
  WORDLE_FOCUS_KEYS,
} from '../constants';
import { useWordleBoard } from '../hooks/useWordleBoard';
import { CurrentRow } from './CurrentRow';
import { GuessRow } from './GuessRow';
import { WordleSettingsScreen } from './WordleSettingsScreen';

export function WordleBoard({
  session,
  config,
  onSaveConfig,
}: {
  session: WsSession;
  config: WordleUserConfig;
  onSaveConfig: (config: WordleUserConfig) => Promise<void>;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation(['wordle', 'common']);
  const [showSettings, setShowSettings] = useState(false);
  const {
    activeIndex,
    backspace,
    connectionState,
    currentLetters,
    error,
    guesses,
    letterStates,
    moveFocus,
    onKeyDownCell,
    pressedKeys,
    registerGrid,
    registerInput,
    setActiveIndex,
    shake,
    solved,
    submitGuess,
    suspendInput,
    typeLetter,
    wordLength,
  } = useWordleBoard(session, {
    enabled: !showSettings,
    enableSpaceKey: config.enableSpaceKey,
    enableArrowKeys: config.enableArrowKeys,
  });
  const keyboardRows = useMemo(
    () =>
      buildKeyboardRows(config).map((row) =>
        row.map((key) => ({
          ...key,
          style: key.style ?? FEEDBACK_COLORS[letterStates[key.id] ?? 'unused'],
        })),
      ),
    [letterStates, config],
  );
  const attemptNumber = guesses.length + (solved ? 0 : 1);

  if (showSettings) {
    return (
      <WordleSettingsScreen
        config={config}
        onSave={onSaveConfig}
        onBack={() => setShowSettings(false)}
      />
    );
  }

  const keyboard = (
    <Keyboard
      rows={keyboardRows}
      pressedKeys={pressedKeys}
      disabled={solved || wordLength === null}
      onKey={(key) => {
        if (key === 'Enter') {
          submitGuess();
        } else if (key === 'Backspace') {
          backspace();
        } else if (key === WORDLE_FOCUS_KEYS.first) {
          moveFocus('first');
        } else if (key === WORDLE_FOCUS_KEYS.left) {
          moveFocus('left');
        } else if (key === WORDLE_FOCUS_KEYS.space) {
          moveFocus('space');
        } else if (key === WORDLE_FOCUS_KEYS.right) {
          moveFocus('right');
        } else if (key === WORDLE_FOCUS_KEYS.last) {
          moveFocus('last');
        } else {
          typeLetter(key);
        }
      }}
    />
  );

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,176,0,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_20%),var(--color-marquinhos-bg)]">
      <GameHeader
        titleKey="wordle.name"
        titleNs="games"
        onBack={() => navigate('/')}
        right={
          <button
            type="button"
            className={`${backChipClass} px-3`}
            aria-label={t('wordle:settingsAriaLabel')}
            title={t('wordle:settingsAriaLabel')}
            onClick={() => {
              suspendInput();
              setShowSettings(true);
            }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-current"
            >
              <path d="M19.14 12.94a7.7 7.7 0 0 0 .05-.94 7.7 7.7 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.1 7.1 0 0 0-1.62-.94L14.39 2.8a.49.49 0 0 0-.49-.4h-3.84a.49.49 0 0 0-.49.4l-.36 2.52a7.4 7.4 0 0 0-1.62.94L5.2 5.3a.49.49 0 0 0-.61.22L2.67 8.84a.49.49 0 0 0 .12.64l2.03 1.58a7.7 7.7 0 0 0-.05.94c0 .32.02.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.22.38.31.61.22l2.39-.96c.5.39 1.04.7 1.62.94l.36 2.52c.04.24.24.4.49.4h3.84c.25 0 .46-.16.49-.4l.36-2.52a7.1 7.1 0 0 0 1.62-.94l2.39.96c.23.09.49 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5" />
            </svg>
          </button>
        }
      />

      {error && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center px-4">
          <div className="notch-6 pointer-events-auto animate-termo-toast-in border border-marquinhos-danger/40 bg-[#1c1b1c] px-4 py-2 text-center text-sm text-marquinhos-danger shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
            {error}
          </div>
        </div>
      )}

      <main className="flex min-h-0 flex-1 items-stretch justify-center overflow-hidden p-2 sm:items-center sm:overflow-y-auto sm:p-6">
        <div className="notch-8 flex w-full flex-1 flex-col gap-3 border border-marquinhos-border bg-[#1c1b1c] px-2 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.35)] sm:w-fit sm:min-w-135 sm:flex-none sm:gap-4 sm:px-6 sm:py-6">
          {solved && (
            <div className="notch-6 flex items-center justify-between gap-3 border border-marquinhos-border bg-black/25 px-4 py-3">
              <div className="text-sm font-semibold text-marquinhos-text">
                {t('wordle:solved', { count: guesses.length })}
              </div>
              <div
                className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{
                  borderColor: `${FEEDBACK_COLORS.correct.bg}80`,
                  backgroundColor: `${FEEDBACK_COLORS.correct.bg}26`,
                  color: '#98d68f',
                }}
              >
                {t('wordle:solvedBadge')}
              </div>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 sm:flex-none">
            <div
              ref={registerGrid}
              className="scrollbar-hide flex min-h-0 flex-initial flex-col gap-1.5 overflow-x-hidden overflow-y-auto px-1.5 py-1 sm:max-h-[42vh] sm:flex-none sm:gap-2"
            >
              {guesses.map((row, index) => (
                <GuessRow key={index} row={row} />
              ))}
              {!solved && wordLength !== null && (
                <CurrentRow
                  letters={currentLetters}
                  activeIndex={activeIndex}
                  wordLength={wordLength}
                  shake={shake}
                  disabled={solved || wordLength === null}
                  registerInput={registerInput}
                  onFocusCell={setActiveIndex}
                  onKeyDownCell={onKeyDownCell}
                />
              )}
            </div>

            {wordLength !== null && (
              <div className="notch-4 border border-marquinhos-border bg-black/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                {t('wordle:progress', {
                  letters: wordLength,
                  attempt: attemptNumber,
                })}
              </div>
            )}
          </div>

          <div className="hidden sm:contents">{keyboard}</div>

          {(connectionState === 'disconnected' ||
            connectionState === 'error') && (
            <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
              {t('common:connectionLost')}
            </div>
          )}
        </div>
      </main>

      <div className="pb-16 sm:hidden">{keyboard}</div>
    </div>
  );
}
