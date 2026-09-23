import {
  serverMessageSchema,
  type HangmanClientMessage,
  type HangmanState,
} from '@marquinhos/contracts/activity/games/hangman';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GameHeader } from '../../../components/game-shell';
import { colyseusUrl } from '../../../lib/apiBase';
import type { WsSession } from '../../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../../shared/useColyseusRoom';
import { HangmanCanvas } from './HangmanCanvas';

export function HangmanBoard({ session }: { session: WsSession }) {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [state, setState] = useState<HangmanState>({
    revealedWord: '',
    guessedLetters: [],
    strikes: 0,
    maxStrikes: 6,
    gameOver: false,
    won: false,
  });
  const [error, setError] = useState<string | null>(null);
  const { revealedWord, guessedLetters, strikes, maxStrikes, gameOver, won } =
    state;

  const { send, connectionState } = useColyseusRoom(
    'hangman',
    session,
    colyseusUrl(),
    (raw: ActivityMessage) => {
      const message = parseMessage(serverMessageSchema, raw);
      if (!message) return;
      switch (message.type) {
        case 'init':
        case 'game_state':
          setState(message.payload);
          setError(null);
          return;
        case 'guess_error':
          setError(message.payload.message);
          return;
        case 'guess_success':
          return;
      }
    },
  );

  function guessLetter(letter: string) {
    send({ type: 'guess', payload: { letter } } satisfies HangmanClientMessage);
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
            disabled={
              connectionState === 'disconnected' || connectionState === 'error'
            }
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
