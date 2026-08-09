import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../lib/apiBase';
import { cn } from '../../lib/cn';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import { useWordChainSession } from './useWordChainSession';
import { WordChainBoard } from './WordChainBoard';

interface GameState {
  currentWord: string;
  currentTurn: string;
  usedWords: string[];
  players: { userId: string; alive: boolean }[];
  gameOver: boolean;
  winner: string | null;
  userId: string;
}

export function WordChainGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
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
      } else if (message.type === 'word_rejected') {
        const payload = message.payload as { error: string };
        setError(payload.error);
        setInputValue('');
      } else if (message.type === 'opponent_disconnected') {
        const payload = message.payload as {
          userId: string;
          timeoutMs: number;
        };
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
      setError('No response from server');
    }, 5000);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      submitWord();
    }
  }

  const isCurrentPlayer = gameState.currentTurn === identity.userId;
  const isGameOver = gameState.gameOver;

  if (session.status === 'selecting-mode') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-accent">
            SELECIONAR MODO
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={() => setMode('single')}
            >
              VS BOT
            </button>
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={() => setMode('multi')}
            >
              VS JOGADOR
            </button>
          </div>
          <button
            type="button"
            className="notch-6 border border-marquinhos-border bg-transparent px-5 py-3 text-sm font-semibold text-marquinhos-text transition hover:bg-marquinhos-panel-hover"
            onClick={() => navigate('/')}
          >
            VOLTAR
          </button>
        </div>
      </div>
    );
  }

  if (session.status === 'connecting') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
            INICIANDO JOGO…
          </div>
          <div className="max-w-[36ch] text-sm leading-6 text-marquinhos-text-dim">
            Conectando à sessão em tempo real e carregando o jogo.
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
            FALHA NA CONEXÃO
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
              Tentar novamente
            </button>
            <button
              type="button"
              className="notch-6 border border-marquinhos-border bg-marquinhos-bg px-5 py-3 text-sm text-marquinhos-text transition hover:border-marquinhos-border-hover"
              onClick={() => navigate('/')}
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,176,0,0.12),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_20%),var(--color-marquinhos-bg)]">
      <header className="flex items-center justify-between gap-4 border-b border-marquinhos-border bg-black/10 px-4 py-3 sm:px-6">
        <div>
          <div className="font-pixel text-sm tracking-[0.28em] text-marquinhos-accent sm:text-base">
            CORRENTE DE PALAVRAS
          </div>
        </div>
        <button
          type="button"
          className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
          onClick={() => navigate('/')}
        >
          Voltar
        </button>
      </header>

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
              OPONENTE DESCONECTADO — AGUARDANDO…
            </div>
          )}
        </div>

        {!isGameOver && (
          <div className="notch-8 flex flex-col gap-3 border border-marquinhos-border bg-marquinhos-panel px-4 py-4 shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
            <div className="text-sm text-marquinhos-text-dim">
              {isCurrentPlayer
                ? 'Sua vez! Digite uma palavra começando com:'
                : `Aguardando ${gameState.currentTurn}...`}
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
                placeholder="Digite uma palavra..."
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
                Enviar
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
              JOGO TERMINADO
            </div>
            <div className="text-sm text-marquinhos-text mb-4">
              {gameState.winner === identity.userId
                ? 'Você venceu!'
                : `${gameState.winner} venceu!`}
            </div>
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent bg-marquinhos-accent px-5 py-2 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={() => navigate('/')}
            >
              Voltar ao Menu
            </button>
          </div>
        )}

        {(connectionState === 'disconnected' ||
          connectionState === 'error') && (
          <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
            Conexão perdida. Recarregue para reconectar.
          </div>
        )}
      </main>
    </div>
  );
}
