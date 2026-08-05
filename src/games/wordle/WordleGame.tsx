import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../lib/apiBase';
import { errorMessage, isAuthError } from '../../lib/http';
import { fetchWsSessionToken, type WsSession } from '../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';

type LetterFeedback = 'correct' | 'present' | 'absent';

interface GuessRow {
  guess: string;
  feedback: LetterFeedback[];
}

type WordleSessionState =
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

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

function feedbackClass(feedback: LetterFeedback): string {
  if (feedback === 'correct') return 'text-marquinhos-accent';
  if (feedback === 'present') return 'text-marquinhos-green';
  return 'text-marquinhos-text-dim';
}

function WordleBoard({ session }: { session: WsSession }) {
  const navigate = useNavigate();
  const [wordLength, setWordLength] = useState<number | null>(null);
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [solved, setSolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');

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
        setInput('');
      } else if (message.type === 'guess_error') {
        const payload = message.payload as { message: string };
        setError(payload.message);
      }
    },
  );

  function submitGuess() {
    const guess = input.trim();
    if (!guess || solved) return;
    send({ type: 'guess', payload: { guess } });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,176,0,0.12),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_20%),var(--color-marquinhos-bg)]">
      <header className="flex items-center justify-between gap-4 border-b border-marquinhos-border bg-black/10 px-4 py-3 sm:px-6">
        <div>
          <div className="font-pixel text-sm tracking-[0.28em] text-marquinhos-accent sm:text-base">
            WORDLE
          </div>
          <div className="mt-1 text-sm text-marquinhos-text-dim">
            Solo realtime puzzle with the same framed UI language.
          </div>
        </div>
        <button
          type="button"
          className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
          onClick={() => navigate('/')}
        >
          Back
        </button>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-6">
        <div className="notch-8 flex w-full max-w-[960px] flex-col gap-6 border border-marquinhos-border bg-marquinhos-panel px-5 py-6 shadow-[0_20px_40px_rgba(0,0,0,0.24)] sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-pixel text-2xl tracking-[0.24em] text-marquinhos-text">
                GUESS THE WORD
              </div>
              {wordLength !== null && (
                <div className="mt-2 text-sm text-marquinhos-text-dim">
                  {wordLength} letters · each row shows feedback in place
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="notch-6 border border-marquinhos-border bg-black/20 px-3 py-2 text-center">
                <div className="text-[10px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                  State
                </div>
                <div className="mt-1 text-sm font-semibold text-marquinhos-text">
                  {solved ? 'Solved' : 'Playing'}
                </div>
              </div>
              <div className="notch-6 border border-marquinhos-border bg-black/20 px-3 py-2 text-center">
                <div className="text-[10px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                  Guesses
                </div>
                <div className="mt-1 text-sm font-semibold text-marquinhos-text">
                  {guesses.length}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <section className="notch-6 border border-marquinhos-border bg-black/20 p-4 sm:p-5">
              <div className="flex flex-col gap-2">
                {guesses.length > 0 ? (
                  guesses.map((row, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap gap-2 font-mono text-sm tracking-[0.28em] sm:text-base"
                    >
                      {row.guess.split('').map((letter, j) => (
                        <span
                          key={j}
                          className={feedbackClass(row.feedback[j] ?? 'absent')}
                        >
                          {letter.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-marquinhos-border px-4 py-8 text-sm text-marquinhos-text-disabled">
                    No guesses yet. Start with your first try.
                  </div>
                )}
              </div>
            </section>

            <aside className="flex flex-col gap-4">
              <div className="notch-6 border border-marquinhos-border bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-marquinhos-text-dim">
                  Enter guess
                </div>
                {solved ? (
                  <div className="mt-3 rounded-[18px] border border-marquinhos-green/40 bg-marquinhos-green/10 px-4 py-3 text-sm text-marquinhos-green">
                    The word is solved. Wait for the next round.
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <input
                      className="notch-6 min-w-0 flex-1 border border-marquinhos-border bg-marquinhos-bg px-3 py-3 font-mono text-sm uppercase tracking-[0.2em] text-marquinhos-text outline-none placeholder:text-marquinhos-text-disabled focus:border-marquinhos-border-hover"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitGuess();
                      }}
                      maxLength={wordLength ?? undefined}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-4 py-3 font-mono text-xs tracking-wide text-marquinhos-bg transition hover:bg-marquinhos-accent-hover"
                      onClick={submitGuess}
                    >
                      GUESS
                    </button>
                  </div>
                )}
              </div>

              <div className="notch-6 border border-marquinhos-border bg-black/20 p-4 text-sm leading-6 text-marquinhos-text-dim">
                Feedback colors match the broader app palette: accent for
                correct, green for present, and muted text for absent letters.
              </div>

              {error && (
                <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-4 text-sm leading-6 text-marquinhos-danger">
                  {error}
                </div>
              )}

              {(connectionState === 'disconnected' ||
                connectionState === 'error') && (
                <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-4 text-sm leading-6 text-marquinhos-danger">
                  Connection lost. Reload to reconnect.
                </div>
              )}
            </aside>
          </div>
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
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
            STARTING GAME…
          </div>
          <div className="max-w-[36ch] text-sm leading-6 text-marquinhos-text-dim">
            Connecting to the realtime session and loading the current puzzle.
          </div>
        </div>
      </div>
    );
  }

  if (session.status === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[560px] flex-col items-center justify-center gap-5 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-danger">
            CONNECTION FAILED
          </div>
          <div className="max-w-[48ch] text-sm leading-6 text-marquinhos-text-dim">
            {session.error}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={onAuthInvalid}
            >
              Retry auth
            </button>
            <button
              type="button"
              className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-5 py-3 text-sm text-marquinhos-text transition hover:border-marquinhos-border-hover"
              onClick={() => navigate('/')}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <WordleBoard session={session.session} />;
}
