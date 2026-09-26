import { useRoomConnectionContext } from '@/platform/realtime/colyseus/RoomConnectionContext';
import {
  serverMessageSchema,
  type WordChainClientMessage,
} from '@marquinhos/contracts/activity/games/wordChain';
import {
  ACTION_REJECTED,
  parseMessage,
} from '@marquinhos/contracts/activity/protocol';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  applyWordChainMessage,
  initialWordChainView,
  isServerReply,
} from '../session/wordChainMessages';
import { WordChainBoard } from './WordChainBoard';

// Renders Word Chain inside a multiplayer Room view — driven by
// RoomConnectionContext instead of WordChainGame's own useColyseusRoom
// call, reusing the existing (already presentational) WordChainBoard.
// Input gating uses the real Discord userId (`currentTurn === userId`),
// same as Dominoes/TowerUnstable — a spectator's own userId never equals
// another player's currentTurn, so this is already safe without a
// role-specific check.
export function WordChainRoomBoard() {
  const ctx = useRoomConnectionContext();
  const { t } = useTranslation(['word-chain', 'common']);
  const [inputValue, setInputValue] = useState('');
  const [view, setView] = useState(initialWordChainView);
  const { state: gameState, error, pausedOpponent } = view;
  const inputRef = useRef<HTMLInputElement>(null);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((raw) => {
      const message = parseMessage(serverMessageSchema, raw);
      if (!message) return;
      if (isServerReply(message) && submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
        submitTimeoutRef.current = null;
      }
      if (message.type === ACTION_REJECTED) setInputValue('');
      setView((current) => applyWordChainMessage(current, message));
    });
  }, [ctx]);

  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
    };
  }, []);

  function submitWord() {
    const word = inputValue.trim();
    if (!word) return;

    setView((current) => ({ ...current, error: null }));
    ctx?.send({
      type: 'word',
      payload: { word },
    } satisfies WordChainClientMessage);
    setInputValue('');

    submitTimeoutRef.current = setTimeout(() => {
      setView((current) => ({
        ...current,
        error: t('word-chain:noResponse'),
      }));
    }, 5000);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') submitWord();
  }

  const userId = ctx?.currentUserId ?? '';
  const isCurrentPlayer = gameState.currentTurn === userId;
  const isGameOver = gameState.gameOver;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
      <div className="notch-8 relative flex-1 overflow-hidden border border-marquinhos-border bg-black/20">
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
                setView((current) => ({ ...current, error: null }));
              }}
              onKeyDown={handleKeyDown}
              disabled={!isCurrentPlayer || isGameOver}
              placeholder={t('word-chain:inputPlaceholder')}
              className="flex-1 rounded-sm border border-marquinhos-border bg-marquinhos-bg px-3 py-2 text-sm text-marquinhos-text placeholder-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="button"
              onClick={submitWord}
              disabled={!isCurrentPlayer || isGameOver || !inputValue.trim()}
              className="notch-6 border border-marquinhos-accent bg-marquinhos-accent px-4 py-2 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="font-pixel mb-2 text-lg text-marquinhos-accent">
            {t('word-chain:gameOverTitle')}
          </div>
          <div className="mb-4 text-sm text-marquinhos-text">
            {gameState.winner === userId
              ? t('word-chain:youWon')
              : t('word-chain:playerWon', { player: gameState.winner })}
          </div>
        </div>
      )}
    </div>
  );
}
