import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../lib/apiBase';
import { errorMessage, isAuthError } from '../../lib/http';
import { fetchWsSessionToken, type WsSession } from '../shared/activitySession';
import { useColyseusRoom, type ActivityMessage } from '../shared/useColyseusRoom';

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
  const [wordLength, setWordLength] = useState<number | null>(null);
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [solved, setSolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');

  const { send } = useColyseusRoom(
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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-7">
      <div className="font-pixel animate-pixel-glow text-2xl tracking-widest text-marquinhos-accent">
        WORDLE
      </div>
      {wordLength !== null && (
        <div className="text-sm text-marquinhos-text-dim">
          {wordLength} LETRAS
        </div>
      )}
      <div className="flex flex-col gap-2">
        {guesses.map((row, i) => (
          <div key={i} className="flex gap-1 font-mono text-sm tracking-widest">
            {row.guess.split('').map((letter, j) => (
              <span key={j} className={feedbackClass(row.feedback[j] ?? 'absent')}>
                {letter.toUpperCase()}
              </span>
            ))}
          </div>
        ))}
      </div>
      {solved ? (
        <div className="font-pixel text-marquinhos-accent">ACERTOU!</div>
      ) : (
        <div className="flex gap-2">
          <input
            className="border border-marquinhos-border bg-marquinhos-panel px-3 py-2 font-mono text-sm text-marquinhos-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
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
            className="notch-6 cursor-pointer border border-marquinhos-border bg-marquinhos-panel px-4 py-2 font-mono text-xs tracking-wide text-marquinhos-text hover:border-marquinhos-border-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
            onClick={submitGuess}
          >
            GUESS
          </button>
        </div>
      )}
      {error && (
        <div className="max-w-[480px] text-center text-sm text-marquinhos-danger">
          {error}
        </div>
      )}
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
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="font-pixel animate-pong-blink text-sm text-marquinhos-accent">
          STARTING GAME…
        </div>
      </div>
    );
  }

  if (session.status === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="font-pixel text-lg text-marquinhos-danger">
          CONNECTION FAILED
        </div>
        <div className="max-w-[480px] text-center text-marquinhos-text-dim">
          {session.error}
        </div>
        <button
          type="button"
          className="notch-6 cursor-pointer border border-marquinhos-border bg-marquinhos-panel px-6 py-4.5 font-mono text-xs tracking-wide text-marquinhos-text hover:border-marquinhos-border-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
          onClick={() => navigate('/')}
        >
          BACK
        </button>
      </div>
    );
  }

  return <WordleBoard session={session.session} />;
}
