import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  ErrorScreen,
  GameHeader,
} from '../../components/game-shell';
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
  const { t } = useTranslation('common');
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
      <GameHeader
        titleKey="hangman.name"
        titleNs="games"
        onBack={() => navigate('/')}
      />

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
                {t('playAgain')}
              </button>
              <button
                type="button"
                className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-5 py-3 text-sm text-marquinhos-text transition hover:border-marquinhos-border-hover"
                onClick={() => navigate('/')}
              >
                {t('backToHub')}
              </button>
            </div>
          )}

          {(connectionState === 'disconnected' ||
            connectionState === 'error') && (
            <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
              {t('connectionLost')}
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
      <ConnectingScreen subtitleKey="connectingSubtitle" subtitleNs="hangman" />
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

  return <HangmanBoard session={session.session} />;
}
