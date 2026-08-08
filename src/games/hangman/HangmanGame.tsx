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
import { HangmanCanvas } from './HangmanCanvas';

type HangmanSessionState =
  | { status: 'connecting' }
  | { status: 'ready'; session: WsSession }
  | { status: 'error'; error: string };

function useHangmanSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
): HangmanSessionState {
  const [state, setState] = useState<HangmanSessionState>({
    status: 'connecting',
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'connecting' });
    fetchWsSessionToken({ game: 'hangman', mode: 'multi', identity })
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

function HangmanBoard({ session }: { session: WsSession }) {
  const navigate = useNavigate();
  const [revealedWord, setRevealedWord] = useState('');
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [strikes, setStrikes] = useState(0);
  const [maxStrikes, setMaxStrikes] = useState(6);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { send, connectionState } = useColyseusRoom(
    'hangman',
    session,
    colyseusUrl(),
    (message: ActivityMessage) => {
      if (message.type === 'init') {
        const payload = message.payload as {
          revealedWord: string;
          guessedLetters: string[];
          strikes: number;
          maxStrikes: number;
          gameOver: boolean;
          won: boolean;
        };
        setRevealedWord(payload.revealedWord);
        setGuessedLetters(payload.guessedLetters);
        setStrikes(payload.strikes);
        setMaxStrikes(payload.maxStrikes);
        setGameOver(payload.gameOver);
        setWon(payload.won);
        setError(null);
      } else if (message.type === 'game_state') {
        const payload = message.payload as {
          revealedWord: string;
          guessedLetters: string[];
          strikes: number;
          maxStrikes: number;
          gameOver: boolean;
          won: boolean;
        };
        setRevealedWord(payload.revealedWord);
        setGuessedLetters(payload.guessedLetters);
        setStrikes(payload.strikes);
        setMaxStrikes(payload.maxStrikes);
        setGameOver(payload.gameOver);
        setWon(payload.won);
        setError(null);
      } else if (message.type === 'guess_error') {
        const payload = message.payload as { message: string };
        setError(payload.message);
      }
    },
  );

  function guessLetter(letter: string) {
    send({ type: 'guess', payload: { letter } });
  }

  function handleRestart() {
    navigate('/');
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,176,0,0.12),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_20%),var(--color-marquinhos-bg)]">
      <header className="flex items-center justify-between gap-4 border-b border-marquinhos-border bg-black/10 px-4 py-3 sm:px-6">
        <div>
          <div className="font-pixel text-sm tracking-[0.28em] text-marquinhos-accent sm:text-base">
            HANGMAN
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

      <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 sm:p-6">
        <div className="notch-8 w-full max-w-[900px] border border-marquinhos-border bg-[#1c1b1c] px-4 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.35)] sm:px-6 sm:py-6">
          <HangmanCanvas
            revealedWord={revealedWord}
            guessedLetters={guessedLetters}
            strikes={strikes}
            maxStrikes={maxStrikes}
            gameOver={gameOver}
            won={won}
            onLetterClick={guessLetter}
            disabled={connectionState === 'disconnected' || connectionState === 'error'}
          />

          {error && (
            <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
              {error}
            </div>
          )}

          {gameOver && (
            <div className="flex justify-center gap-3 pt-4">
              <button
                type="button"
                className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
                onClick={handleRestart}
              >
                Play Again
              </button>
              <button
                type="button"
                className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-5 py-3 text-sm text-marquinhos-text transition hover:border-marquinhos-border-hover"
                onClick={() => navigate('/')}
              >
                Back to Hub
              </button>
            </div>
          )}

          {(connectionState === 'disconnected' ||
            connectionState === 'error') && (
            <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
              Connection lost. Reload to reconnect.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export function HangmanGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const session = useHangmanSession(identity, onAuthInvalid);

  if (session.status === 'connecting') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
            STARTING GAME…
          </div>
          <div className="max-w-[36ch] text-sm leading-6 text-marquinhos-text-dim">
            Connecting to the realtime session and loading the hangman game.
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

  return <HangmanBoard session={session.session} />;
}
