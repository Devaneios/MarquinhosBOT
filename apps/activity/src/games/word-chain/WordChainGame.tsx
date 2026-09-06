import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ConnectingScreen,
  ErrorScreen,
  GameHeader,
  ModeSelectScreen,
} from '../../components/game-shell';
import type { DiscordIdentity } from '../../discordAuth.ts';
import { colyseusUrl } from '../../lib/apiBase';
import { cn } from '../../lib/cn';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import { WordChainBoard } from './components';
import { useWordChainSession } from './hooks/useWordChainSession';
import type {
  GameState,
  OpponentDisconnectedPayload,
  WordRejectedPayload,
} from './types';

export function WordChainGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation(['word-chain', 'common']);
  const [mode, setMode] = useState<'single' | 'multi' | null>(null);
  const session = useWordChainSession(identity, mode, onAuthInvalid);
  const [gameState, setGameState] = useState<GameState>({
    currentWord: '',
    currentTurn: '',
    usedWords: [],
    players: [],
    gameOver: false,
    winner: null,
    userId: identity.userId,
  });
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pausedOpponent, setPausedOpponent] = useState<{
    userId: string;
    timeoutMs: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { send, connectionState } = useColyseusRoom(
    'word-chain',
    session.status === 'ready' ? session.session : null,
    colyseusUrl(),
    (message: ActivityMessage) => {
      if (message.type === 'init') {
        const payload = message.payload as Partial<GameState>;
        setGameState((prev) => ({ ...prev, ...payload }));
        setError(null);
      } else if (message.type === 'state') {
        const payload = message.payload as Partial<GameState>;
        setGameState((prev) => ({ ...prev, ...payload }));
      } else if (message.type === 'action_rejected') {
        // wordChainAdapter.ts (server) sends ACTION_REJECTED
        // ('action_rejected') for a rejected word, not 'word_rejected' —
        // same bug class found in Checkers/Tic-Tac-Toe/TowerUnstable, fixed
        // here too.
        const payload = message.payload as WordRejectedPayload;
        setError(payload.error);
        setInputValue('');
      } else if (message.type === 'opponent_disconnected') {
        const payload = message.payload as OpponentDisconnectedPayload;
        setPausedOpponent(payload);
      } else if (message.type === 'opponent_reconnected') {
        setPausedOpponent(null);
      }
    },
  );

  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
    };
  }, []);

  function submitWord() {
    const word = inputValue.trim();
    if (!word) return;

    setError(null);
    send({ type: 'word', payload: { word } });
    setInputValue('');

    submitTimeoutRef.current = setTimeout(() => {
      setError(t('word-chain:noResponse'));
    }, 5000);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      submitWord();
    }
  }

  const isCurrentPlayer = gameState.currentTurn === identity.userId;
  const isGameOver = gameState.gameOver;

  if (session.status === 'selecting-mode') {
    return (
      <ModeSelectScreen
        onBack={() => navigate('/')}
        options={[
          {
            key: 'single',
            labelKey: 'vsBot',
            labelNs: 'common',
            onSelect: () => setMode('single'),
          },
          {
            key: 'multi',
            labelKey: 'vsPlayer',
            labelNs: 'common',
            onSelect: () => navigate('/rooms?create=word-chain'),
          },
        ]}
      />
    );
  }

  if (session.status === 'connecting') {
    return (
      <ConnectingScreen
        subtitleKey="connectingSubtitle"
        subtitleNs="word-chain"
      />
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,176,0,0.12),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_20%),var(--color-marquinhos-bg)]">
      <GameHeader
        titleKey="word-chain.name"
        titleNs="games"
        onBack={() => navigate('/')}
      />

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <div className="relative flex-1 rounded-lg border border-marquinhos-border bg-black/20 overflow-hidden">
          <WordChainBoard
            currentTurn={gameState.currentTurn}
            players={gameState.players}
            gameOver={gameState.gameOver}
            winner={gameState.winner}
            usedWords={gameState.usedWords}
          />
          {pausedOpponent && !isGameOver && (
            <div className="notch-3 font-pixel animate-pong-blink absolute top-3 left-1/2 -translate-x-1/2 border border-marquinhos-accent bg-marquinhos-panel px-2.5 py-1 text-[11px] tracking-wide text-marquinhos-accent">
              {t('word-chain:opponentDisconnected')}
            </div>
          )}
        </div>

        {!isGameOver && (
          <div className="notch-8 flex flex-col gap-3 border border-marquinhos-border bg-marquinhos-panel px-4 py-4 shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
            <div className="text-sm text-marquinhos-text-dim">
              {isCurrentPlayer
                ? t('word-chain:yourTurnPrompt')
                : t('word-chain:waitingForTurn', {
                    player: gameState.currentTurn,
                  })}
            </div>

            {gameState.currentWord && (
              <div className="font-pixel text-2xl text-marquinhos-accent">
                "
                {gameState.currentWord[
                  gameState.currentWord.length - 1
                ].toUpperCase()}
                "
              </div>
            )}

            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                disabled={!isCurrentPlayer || isGameOver}
                placeholder={t('word-chain:inputPlaceholder')}
                className={cn(
                  'flex-1 rounded-md border border-marquinhos-border bg-black/25 px-3 py-2 text-sm text-marquinhos-text placeholder-marquinhos-text-dim focus:outline-none focus:ring-2 focus:ring-marquinhos-accent disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              />
              <button
                type="button"
                onClick={submitWord}
                disabled={!isCurrentPlayer || isGameOver || !inputValue.trim()}
                className="notch-6 border border-marquinhos-accent bg-marquinhos-accent px-4 py-2 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('word-chain:submit')}
              </button>
            </div>

            {error && (
              <div className="text-sm text-marquinhos-danger">{error}</div>
            )}
          </div>
        )}

        {isGameOver && (
          <div className="notch-8 border border-marquinhos-border bg-marquinhos-panel px-4 py-6 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
            <div className="font-pixel text-lg text-marquinhos-accent mb-2">
              {t('word-chain:gameOverTitle')}
            </div>
            <div className="text-sm text-marquinhos-text mb-4">
              {gameState.winner === identity.userId
                ? t('word-chain:youWon')
                : t('word-chain:playerWon', { player: gameState.winner })}
            </div>
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent bg-marquinhos-accent px-5 py-2 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={() => navigate('/')}
            >
              {t('common:backToHub')}
            </button>
          </div>
        )}

        {(connectionState === 'disconnected' ||
          connectionState === 'error') && (
          <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
            {t('common:connectionLost')}
          </div>
        )}
      </main>
    </div>
  );
}
