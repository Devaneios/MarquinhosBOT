import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GameHeader } from '../../../components/game-shell';
import { Keyboard } from '../../../components/keyboard';
import type { WsSession } from '../../shared/activitySession';
import { FEEDBACK_COLORS, KEYBOARD_ROWS } from '../constants';
import { useWordleBoard } from '../useWordleBoard';
import { CurrentRow } from './CurrentRow';
import { GuessRow } from './GuessRow';

export function WordleBoard({ session }: { session: WsSession }) {
  const navigate = useNavigate();
  const { t } = useTranslation(['wordle', 'common']);
  const board = useWordleBoard(session);
  const keyboardRows = useMemo(
    () =>
      KEYBOARD_ROWS.map((row) =>
        row.map((key) => ({
          ...key,
          style:
            key.style ??
            FEEDBACK_COLORS[board.letterStates[key.id] ?? 'unused'],
        })),
      ),
    [board.letterStates],
  );
  const attemptNumber = board.guesses.length + (board.solved ? 0 : 1);

  const keyboard = (
    <Keyboard
      rows={keyboardRows}
      pressedKeys={board.pressedKeys}
      disabled={board.solved || board.wordLength === null}
      onKey={(key) => {
        if (key === 'Enter') {
          board.submitGuess();
        } else if (key === 'Backspace') {
          board.backspace();
        } else {
          board.typeLetter(key);
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
      />

      {board.error && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center px-4">
          <div className="notch-6 pointer-events-auto animate-termo-toast-in border border-marquinhos-danger/40 bg-[#1c1b1c] px-4 py-2 text-center text-sm text-marquinhos-danger shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
            {board.error}
          </div>
        </div>
      )}

      <main className="flex min-h-0 flex-1 items-stretch justify-center overflow-hidden p-2 sm:items-center sm:overflow-y-auto sm:p-6">
        <div className="notch-8 flex w-full flex-1 flex-col gap-3 border border-marquinhos-border bg-[#1c1b1c] px-2 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.35)] sm:w-fit sm:min-w-[33.75rem] sm:flex-none sm:gap-4 sm:px-6 sm:py-6">
          {board.solved && (
            <div className="notch-6 flex items-center justify-between gap-3 border border-marquinhos-border bg-black/25 px-4 py-3">
              <div className="text-sm font-semibold text-marquinhos-text">
                {t('wordle:solved', { count: board.guesses.length })}
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
              ref={board.gridRef}
              className="scrollbar-hide flex min-h-0 flex-initial flex-col gap-1.5 overflow-x-hidden overflow-y-auto px-1.5 py-1 sm:max-h-[42vh] sm:flex-none sm:gap-2"
            >
              {board.guesses.map((row, index) => (
                <GuessRow key={index} row={row} />
              ))}
              {!board.solved && board.wordLength !== null && (
                <CurrentRow
                  letters={board.currentLetters}
                  activeIndex={board.activeIndex}
                  wordLength={board.wordLength}
                  shake={board.shake}
                  disabled={board.solved || !!board.wordLength}
                  inputRefs={board.inputRefs}
                  onFocusCell={board.setActiveIndex}
                  onKeyDownCell={board.onKeyDownCell}
                />
              )}
            </div>

            {board.wordLength !== null && (
              <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                {t('wordle:progress', {
                  letters: board.wordLength,
                  attempt: attemptNumber,
                })}
              </div>
            )}
          </div>

          <div className="hidden sm:contents">{keyboard}</div>

          {(board.connectionState === 'disconnected' ||
            board.connectionState === 'error') && (
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
