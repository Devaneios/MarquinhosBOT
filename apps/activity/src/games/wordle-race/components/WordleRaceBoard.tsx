import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ConnectingScreen, GameHeader } from '../../../components/game-shell';
import { colyseusUrl } from '../../../lib/apiBase';
import { cn } from '../../../lib/cn';
import type { WsSession } from '../../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../../shared/useColyseusRoom';
import { FEEDBACK_COLORS, KB_LETTERS, KB_ROWS } from '../constants';
import type { GameState, GuessRow, LetterFeedback } from '../types';
import { buildLetterStates, normalizeKey } from '../utils';

function Tile({
  letter,
  feedback,
}: {
  letter: string;
  feedback?: LetterFeedback;
}) {
  const colors = feedback ? FEEDBACK_COLORS[feedback] : null;
  return (
    <div
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-md border font-pixel text-base font-bold uppercase sm:h-11 sm:w-11',
        colors
          ? 'border-transparent'
          : letter
            ? 'border-marquinhos-border-hover'
            : 'border-marquinhos-border/60',
      )}
      style={
        colors ? { backgroundColor: colors.bg, color: colors.text } : undefined
      }
    >
      {letter}
    </div>
  );
}

function GuessRowView({ row }: { row: GuessRow }) {
  return (
    <div className="flex gap-1 sm:gap-1.5">
      {row.guess.split('').map((letter, i) => (
        <Tile
          key={i}
          letter={letter.toUpperCase()}
          feedback={row.feedback[i]}
        />
      ))}
    </div>
  );
}

function CurrentRowView({
  value,
  wordLength,
  shake,
}: {
  value: string;
  wordLength: number;
  shake: boolean;
}) {
  const letters = Array.from({ length: wordLength }, (_, i) =>
    (value[i] ?? '').toUpperCase(),
  );
  return (
    <div
      className={cn('flex gap-1 sm:gap-1.5', shake && 'animate-termo-shake')}
    >
      {letters.map((letter, i) => (
        <Tile key={i} letter={letter} />
      ))}
    </div>
  );
}

function KeyButton({
  label,
  state,
  wide,
  disabled,
  onClick,
}: {
  label: string;
  state?: LetterFeedback;
  wide?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const colors = FEEDBACK_COLORS[state ?? 'unused'];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{ backgroundColor: colors.bg, color: colors.text }}
      className={cn(
        'flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-xs font-bold uppercase shadow-[0_2px_3px_rgba(0,0,0,0.4)] transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50',
        wide ? 'min-w-[44px] px-2 text-[9px] sm:min-w-[50px]' : 'w-6 sm:w-7',
      )}
    >
      {label}
    </button>
  );
}

function Keyboard({
  letterStates,
  disabled,
  onKey,
  onEnter,
  onBackspace,
}: {
  letterStates: Record<string, LetterFeedback>;
  disabled: boolean;
  onKey: (letter: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
}) {
  const { t } = useTranslation('wordle-race');
  return (
    <div className="flex flex-col items-center gap-1">
      {KB_ROWS.map((row, i) => (
        <div key={row} className="flex justify-center gap-1">
          {i === KB_ROWS.length - 1 && (
            <KeyButton
              label={t('enter')}
              wide
              disabled={disabled}
              onClick={onEnter}
            />
          )}
          {row.split('').map((letter) => (
            <KeyButton
              key={letter}
              label={letter}
              state={letterStates[letter]}
              disabled={disabled}
              onClick={() => onKey(letter)}
            />
          ))}
          {i === KB_ROWS.length - 1 && (
            <KeyButton
              label="⌫"
              wide
              disabled={disabled}
              onClick={onBackspace}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function WordleRaceBoard({
  session,
  userId,
}: {
  session: WsSession;
  userId: string;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation(['wordle-race', 'common']);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentGuess, setCurrentGuess] = useState('');
  const [shake, setShake] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const shakeTimeout = useRef<number | undefined>(undefined);

  const { send, connectionState } = useColyseusRoom(
    'wordle-race',
    session,
    colyseusUrl(),
    (message: ActivityMessage) => {
      if (message.type === 'init') {
        const payload = message.payload as GameState;
        setGameState(payload);
        setError(null);
      } else if (message.type === 'guess_submitted') {
        const payload = message.payload as {
          userId: string;
          guess: string;
          feedback: LetterFeedback[];
          attempts: number;
          solved: boolean;
        };
        setGameState((prev) => {
          if (!prev) return prev;
          const newState = { ...prev };
          if (payload.userId === userId) {
            newState.currentPlayerGuesses = [
              ...newState.currentPlayerGuesses,
              { guess: payload.guess, feedback: payload.feedback },
            ];
            newState.currentPlayerSolved = payload.solved;
          }
          const playerIdx = newState.players.findIndex(
            (p) => p.userId === payload.userId,
          );
          if (playerIdx >= 0) {
            newState.players[playerIdx].attempts = payload.attempts;
            newState.players[playerIdx].solved = payload.solved;
            newState.players[playerIdx].guesses = [
              ...newState.players[playerIdx].guesses,
              { guess: payload.guess, feedback: payload.feedback },
            ];
          }
          return newState;
        });
        setCurrentGuess('');
        setError(null);
      } else if (message.type === 'guess_error') {
        const payload = message.payload as { error: string };
        setError(payload.error);
        triggerShake();
      } else if (message.type === 'player_solved') {
        const payload = message.payload as {
          userId: string;
          firstSolver: boolean;
        };
        if (payload.firstSolver) {
          setGameState((prev) =>
            prev ? { ...prev, firstSolver: payload.userId } : prev,
          );
        }
      } else if (message.type === 'player_exhausted') {
        const payload = message.payload as { userId: string };
        setGameState((prev) => {
          if (!prev) return prev;
          const newState = { ...prev };
          const playerIdx = newState.players.findIndex(
            (p) => p.userId === payload.userId,
          );
          if (playerIdx >= 0) {
            newState.players[playerIdx].exhausted = true;
          }
          if (payload.userId === userId) {
            newState.currentPlayerExhausted = true;
          }
          return newState;
        });
      } else if (message.type === 'game_ended') {
        setGameState((prev) => (prev ? { ...prev, gameOver: true } : prev));
      }
    },
  );

  const letterStates = useMemo(
    () => buildLetterStates(gameState?.currentPlayerGuesses ?? []),
    [gameState?.currentPlayerGuesses],
  );

  useEffect(() => {
    const el = gridRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [gameState?.currentPlayerGuesses?.length]);

  useEffect(() => {
    return () => window.clearTimeout(shakeTimeout.current);
  }, []);

  function triggerShake() {
    setShake(true);
    window.clearTimeout(shakeTimeout.current);
    shakeTimeout.current = window.setTimeout(() => setShake(false), 380);
  }

  function typeLetter(letter: string) {
    if (
      gameState?.currentPlayerSolved ||
      gameState?.currentPlayerExhausted ||
      gameState?.gameOver ||
      !gameState
    )
      return;
    setError(null);
    setCurrentGuess((prev) =>
      prev.length < gameState.targetWordLength ? prev + letter : prev,
    );
  }

  function backspace() {
    if (gameState?.currentPlayerSolved || gameState?.gameOver || !gameState)
      return;
    setError(null);
    setCurrentGuess((prev) => prev.slice(0, -1));
  }

  function submitGuess() {
    if (
      gameState?.currentPlayerSolved ||
      gameState?.currentPlayerExhausted ||
      gameState?.gameOver ||
      !gameState
    )
      return;
    if (currentGuess.length !== gameState.targetWordLength) {
      triggerShake();
      return;
    }
    send({ type: 'guess', payload: { guess: currentGuess } });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Enter') {
        submitGuess();
        return;
      }
      if (event.key === 'Backspace') {
        backspace();
        return;
      }
      if (event.key.length !== 1) return;
      const key = normalizeKey(event.key);
      if (KB_LETTERS.has(key)) typeLetter(key);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gameState?.currentPlayerSolved,
    gameState?.currentPlayerExhausted,
    gameState?.gameOver,
    gameState?.targetWordLength,
    currentGuess,
  ]);

  if (!gameState) {
    return <ConnectingScreen />;
  }

  const attemptNumber =
    gameState.currentPlayerGuesses.length +
    (gameState.currentPlayerSolved ? 0 : 1);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,176,0,0.12),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_20%),var(--color-marquinhos-bg)]">
      <GameHeader
        titleKey="wordle-race.name"
        titleNs="games"
        onBack={() => navigate('/')}
      />

      <main className="flex min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-6">
        <div className="notch-8 flex w-full max-w-[420px] flex-col gap-4 border border-marquinhos-border bg-[#1c1b1c] px-4 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.35)] sm:px-6 sm:py-6">
          {gameState.currentPlayerSolved && (
            <div className="notch-6 flex items-center justify-between gap-3 border border-marquinhos-border bg-black/25 px-4 py-3">
              <div className="text-sm font-semibold text-marquinhos-text">
                {t('wordle-race:solved', {
                  count: gameState.currentPlayerGuesses.length,
                })}
              </div>
              <div
                className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{
                  borderColor: `${FEEDBACK_COLORS.correct.bg}80`,
                  backgroundColor: `${FEEDBACK_COLORS.correct.bg}26`,
                  color: '#98d68f',
                }}
              >
                {t('wordle-race:solvedBadge')}
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            <div
              ref={gridRef}
              className="flex max-h-[42vh] flex-col gap-1 overflow-y-auto py-1 sm:gap-1.5"
            >
              {gameState.currentPlayerGuesses.map((row, i) => (
                <GuessRowView key={i} row={row} />
              ))}
              {!gameState.currentPlayerSolved &&
                !gameState.currentPlayerExhausted &&
                !gameState.gameOver && (
                  <CurrentRowView
                    value={currentGuess}
                    wordLength={gameState.targetWordLength}
                    shake={shake}
                  />
                )}
            </div>

            <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
              {t('wordle-race:progress', {
                letters: gameState.targetWordLength,
                attempt: attemptNumber,
              })}
            </div>

            {error && (
              <div className="text-center text-sm text-marquinhos-danger">
                {error}
              </div>
            )}
          </div>

          <Keyboard
            letterStates={letterStates}
            disabled={
              gameState.currentPlayerSolved ||
              gameState.currentPlayerExhausted ||
              gameState.gameOver
            }
            onKey={typeLetter}
            onEnter={submitGuess}
            onBackspace={backspace}
          />

          {(connectionState === 'disconnected' ||
            connectionState === 'error') && (
            <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
              {t('common:connectionLost')}
            </div>
          )}
        </div>

        <div className="hidden min-h-0 flex-1 flex-col gap-4 overflow-y-auto lg:flex">
          <div className="notch-8 border border-marquinhos-border bg-[#1c1b1c] px-6 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
            <div className="mb-4 font-pixel text-sm tracking-[0.24em] text-marquinhos-accent">
              {t('wordle-race:players')}
            </div>
            <div className="space-y-2">
              {gameState.players.map((player) => (
                <div
                  key={player.userId}
                  className={cn(
                    'notch-4 border px-3 py-2 text-sm',
                    player.userId === gameState.firstSolver
                      ? 'border-marquinhos-accent/60 bg-marquinhos-accent/10'
                      : 'border-marquinhos-border/40 bg-black/20',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">
                      {player.userId === userId
                        ? t('common:you')
                        : player.userId}
                    </div>
                    <div className="text-xs text-marquinhos-text-dim">
                      {player.attempts}/{gameState.maxAttempts}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-marquinhos-text-dim">
                    {player.solved
                      ? t('wordle-race:solvedCheck')
                      : player.exhausted
                        ? t('wordle-race:noAttemptsLeft')
                        : t('wordle-race:attemptsRemaining', {
                            count: gameState.maxAttempts - player.attempts,
                          })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
