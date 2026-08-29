import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  ErrorScreen,
  GameHeader,
} from '../../components/game-shell';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../lib/apiBase';
import { cn } from '../../lib/cn';
import { errorMessage, isAuthError } from '../../lib/http';
import { fetchWsSessionToken, type WsSession } from '../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import './keycap.css';

type LetterFeedback = 'correct' | 'present' | 'absent';
type KeyState = LetterFeedback | 'unused';

interface GuessRow {
  guess: string;
  feedback: LetterFeedback[];
}

type WordleSessionState =
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

// Colors lifted straight from the bot's termo canvas theme
// (MarquinhosBOT src/ui/theme.ts) so the activity board reads as the same
// game as the Discord slash command.
const FEEDBACK_COLORS: Record<
  KeyState,
  {
    bg: string;
    text: string;
    base: [string, string];
    cap: [string, string];
    surface: [string, string];
  }
> = {
  correct: {
    bg: '#588157',
    text: '#E8E8E8',
    base: ['#4a7a4a', '#3d6b3d'],
    cap: ['#4a7a4a', '#3d6b3d'],
    surface: ['#356335', '#4a7a4a'],
  },
  present: {
    bg: '#C0A054',
    text: '#1C1C1E',
    base: ['#b8944a', '#a07e3a'],
    cap: ['#b8944a', '#a07e3a'],
    surface: ['#8a6e30', '#b8944a'],
  },
  absent: {
    bg: '#3A3A3C',
    text: '#E8E8E8',
    base: ['#424242', '#343434'],
    cap: ['#424242', '#343434'],
    surface: ['#2d2d2d', '#424242'],
  },
  unused: {
    bg: '#818384',
    text: '#1C1C1E',
    base: ['#6e6e6e', '#5a5a5a'],
    cap: ['#6e6e6e', '#5a5a5a'],
    surface: ['#555555', '#6e6e6e'],
  },
};

const KB_ROWS = ['qwertyuiop', 'asdfghjklç', 'zxcvbnm'];
const KB_LETTERS = new Set(KB_ROWS.join(''));

function normalizeKey(ch: string): string {
  const lower = ch.toLowerCase();
  if (KB_LETTERS.has(lower)) return lower;
  const stripped = lower.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return KB_LETTERS.has(stripped) ? stripped : lower;
}

function buildLetterStates(
  guesses: GuessRow[],
): Record<string, LetterFeedback> {
  const priority: Record<LetterFeedback, number> = {
    correct: 3,
    present: 2,
    absent: 1,
  };
  const state: Record<string, LetterFeedback> = {};
  for (const { guess, feedback } of guesses) {
    for (let i = 0; i < guess.length; i++) {
      const key = normalizeKey(guess[i]);
      const current = state[key];
      if (!current || priority[feedback[i]] > priority[current]) {
        state[key] = feedback[i];
      }
    }
  }
  return state;
}

// Wordle has no mode selection (it's always a solo guess against the
// guild's daily word, shared with the bot command), so unlike Pong's
// usePongSession this connects immediately instead of waiting on a menu
// pick — the shared piece between the two is just fetchWsSessionToken.
function useWordleSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
): WordleSessionState {
  const [state, setState] = useState<WordleSessionState>({
    status: 'connecting',
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'connecting' });
    fetchWsSessionToken({ game: 'wordle', mode: 'single', identity })
      .then((session) => {
        if (cancelled) return;
        setState({ status: 'ready', session });
      })
      .catch((err) => {
        if (cancelled) return;
        if (isAuthError(err)) {
          onAuthInvalid();
          return;
        }
        setState({ status: 'error', error: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [identity, onAuthInvalid]);

  return state;
}

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
        'flex h-11 w-11 items-center justify-center rounded-md border font-pixel text-lg font-bold uppercase sm:h-12 sm:w-12',
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
    <div className="flex gap-1.5 sm:gap-2">
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
      className={cn('flex gap-1.5 sm:gap-2', shake && 'animate-termo-shake')}
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
  pressed,
  onClick,
}: {
  label: string;
  state?: LetterFeedback;
  wide?: boolean;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  const colors = FEEDBACK_COLORS[state ?? 'unused'];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={
        {
          '--base-from': colors.base[0],
          '--base-to': colors.base[1],
          '--cap-from': colors.cap[0],
          '--cap-to': colors.cap[1],
          '--surface-from': colors.surface[0],
          '--surface-to': colors.surface[1],
          '--key-text': colors.text,
        } as React.CSSProperties
      }
      className={cn(
        'keycap shrink-0 border-none pt-0 shadow-[0_4px_2px_0_rgba(0,0,0,0.4)] transition-[scale] duration-100 ease-in-out disabled:opacity-50',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        wide ? 'min-w-11.5 sm:min-w-13' : '',
        pressed && 'keycap-pressed',
      )}
    >
      <span className="keycap-cap inline-block border-none p-1.5 shadow-[0_4px_6px_rgba(0,0,0,0.3),0_-1px_0_rgba(0,0,0,0.2)] transition-[scale] duration-100 ease-in-out">
        <span
          className={cn(
            'keycap-text block rounded-[50px] font-bold uppercase',
            wide ? 'px-2 py-1.5 text-[10px]' : 'px-2.5 py-1.5 text-xs',
          )}
        >
          {label}
        </span>
      </span>
    </button>
  );
}

function Keyboard({
  letterStates,
  pressedKeys,
  disabled,
  onKey,
  onEnter,
  onBackspace,
}: {
  letterStates: Record<string, LetterFeedback>;
  pressedKeys: ReadonlySet<string>;
  disabled: boolean;
  onKey: (letter: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
}) {
  const { t } = useTranslation('wordle');
  return (
    <div className="flex flex-col items-center gap-1.5">
      {KB_ROWS.map((row, i) => (
        <div
          key={row}
          className={cn(
            'flex justify-center gap-1.5',
            i === KB_ROWS.length - 2 ? 'pl-10' : '',
            i === KB_ROWS.length - 1 ? 'pl-15' : '',
          )}
        >
          {row.split('').map((letter) => (
            <KeyButton
              key={letter}
              label={letter}
              state={letterStates[letter]}
              pressed={pressedKeys.has(letter)}
              disabled={disabled}
              onClick={() => onKey(letter)}
            />
          ))}
          {i === KB_ROWS.length - 1 && (
            <KeyButton
              label="⌫"
              pressed={pressedKeys.has('Backspace')}
              disabled={disabled}
              onClick={onBackspace}
            />
          )}
          {i === KB_ROWS.length - 1 && (
            <KeyButton
              label={t('enter')}
              pressed={pressedKeys.has('Enter')}
              disabled={disabled}
              onClick={onEnter}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function WordleBoard({ session }: { session: WsSession }) {
  const navigate = useNavigate();
  const { t } = useTranslation(['wordle', 'common']);
  const [wordLength, setWordLength] = useState<number | null>(null);
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [solved, setSolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentGuess, setCurrentGuess] = useState('');
  const [shake, setShake] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const shakeTimeout = useRef<number | undefined>(undefined);
  const [pressedKeys, setPressedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const pressTimers = useRef<Map<string, number>>(new Map());

  const { send, connectionState } = useColyseusRoom(
    'wordle',
    session,
    colyseusUrl(),
    (message: ActivityMessage) => {
      if (message.type === 'init') {
        const payload = message.payload as {
          wordLength: number;
          guesses: GuessRow[];
          solved: boolean;
        };
        setWordLength(payload.wordLength);
        setGuesses(payload.guesses);
        setSolved(payload.solved);
        setError(null);
      } else if (message.type === 'guess_result') {
        const payload = message.payload as {
          guesses: GuessRow[];
          solved: boolean;
        };
        setGuesses(payload.guesses);
        setSolved(payload.solved);
        setError(null);
        setCurrentGuess('');
      } else if (message.type === 'guess_error') {
        const payload = message.payload as { message: string };
        setError(payload.message);
        triggerShake();
      }
    },
  );

  const letterStates = useMemo(() => buildLetterStates(guesses), [guesses]);

  useEffect(() => {
    const el = gridRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [guesses.length]);

  useEffect(() => {
    return () => window.clearTimeout(shakeTimeout.current);
  }, []);

  function triggerShake() {
    setShake(true);
    window.clearTimeout(shakeTimeout.current);
    shakeTimeout.current = window.setTimeout(() => setShake(false), 380);
  }

  function typeLetter(letter: string) {
    if (solved || wordLength === null) return;
    setError(null);
    setCurrentGuess((prev) =>
      prev.length < wordLength ? prev + letter : prev,
    );
  }

  function backspace() {
    if (solved) return;
    setError(null);
    setCurrentGuess((prev) => prev.slice(0, -1));
  }

  function submitGuess() {
    if (solved || wordLength === null) return;
    if (currentGuess.length !== wordLength) {
      triggerShake();
      return;
    }
    send({ type: 'guess', payload: { guess: currentGuess } });
  }

  const pressKey = useCallback((key: string) => {
    const timer = pressTimers.current.get(key);
    if (timer !== undefined) window.clearTimeout(timer);
    pressTimers.current.delete(key);
    setPressedKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const releaseKey = useCallback((key: string) => {
    const MIN_PRESS_MS = 100;
    const timer = pressTimers.current.get(key);
    if (timer !== undefined) window.clearTimeout(timer);
    pressTimers.current.set(
      key,
      window.setTimeout(() => {
        pressTimers.current.delete(key);
        setPressedKeys((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, MIN_PRESS_MS),
    );
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of pressTimers.current.values()) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    function resolveVirtualKey(event: KeyboardEvent): string | null {
      if (event.key === 'Enter') return 'Enter';
      if (event.key === 'Backspace') return 'Backspace';
      if (event.key.length !== 1) return null;
      const key = normalizeKey(event.key);
      return KB_LETTERS.has(key) ? key : null;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const vk = resolveVirtualKey(event);
      if (vk !== null) pressKey(vk);
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

    function onKeyUp(event: KeyboardEvent) {
      const vk = resolveVirtualKey(event);
      if (vk !== null) releaseKey(vk);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, wordLength, currentGuess, pressKey, releaseKey]);

  const attemptNumber = guesses.length + (solved ? 0 : 1);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,176,0,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_20%),var(--color-marquinhos-bg)]">
      <GameHeader
        titleKey="wordle.name"
        titleNs="games"
        onBack={() => navigate('/')}
      />

      <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6">
        <div className="notch-8 flex w-fit flex-col gap-4 border border-marquinhos-border bg-[#1c1b1c] px-4 py-8 shadow-[0_20px_40px_rgba(0,0,0,0.35)] sm:px-6 sm:py-6">
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

          <div className="flex flex-col items-center gap-3">
            <div
              ref={gridRef}
              className="flex max-h-[42vh] flex-col gap-1.5 overflow-y-auto py-1 sm:gap-2"
            >
              {guesses.map((row, i) => (
                <GuessRowView key={i} row={row} />
              ))}
              {!solved && wordLength !== null && (
                <CurrentRowView
                  value={currentGuess}
                  wordLength={wordLength}
                  shake={shake}
                />
              )}
            </div>

            {wordLength !== null && (
              <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                {t('wordle:progress', {
                  letters: wordLength,
                  attempt: attemptNumber,
                })}
              </div>
            )}

            {error && (
              <div className="text-center text-sm text-marquinhos-danger">
                {error}
              </div>
            )}
          </div>

          <Keyboard
            letterStates={letterStates}
            pressedKeys={pressedKeys}
            disabled={solved || wordLength === null}
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
      </main>
    </div>
  );
}

export function WordleGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const session = useWordleSession(identity, onAuthInvalid);

  if (session.status === 'connecting') {
    return (
      <ConnectingScreen subtitleKey="connectingSubtitle" subtitleNs="wordle" />
    );
  }

  if (session.status === 'error') {
    return (
      <ErrorScreen
        message={session.error}
        onRetryAuth={onAuthInvalid}
        onBack={() => navigate('/')}
      />
    );
  }

  return <WordleBoard session={session.session} />;
}
