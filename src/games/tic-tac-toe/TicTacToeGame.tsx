import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { colyseusUrl } from '../../lib/apiBase';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import { TicTacToeCanvas } from './TicTacToeCanvas';
import type { TicTacToeState } from './useTicTacToeSession';
import { useTicTacToeSession } from './useTicTacToeSession';

export function TicTacToeGame({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  const navigate = useNavigate();
  const {
    state: sessionState,
    selectMode,
    backToMenu,
  } = useTicTacToeSession(identity, onAuthInvalid);

  const [gameState, setGameState] = useState<TicTacToeState>({
    board: [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ],
    currentPlayer: 'X',
    winner: null,
    isDraw: false,
    moveCount: 0,
  });

  const [player, setPlayer] = useState<string>('X');
  const [error, setError] = useState<string>('');

  const onMessage = useCallback((message: ActivityMessage) => {
    if (message.type === 'init') {
      const payload = message.payload as {
        player: string;
        state: TicTacToeState;
      };
      setPlayer(payload.player);
      setGameState(payload.state);
    } else if (message.type === 'state_update') {
      const payload = message.payload as {
        board: (string | null)[][];
        currentPlayer: string;
        winner: string | null;
        isDraw: boolean;
        moveCount: number;
      };
      setGameState(payload);
    } else if (message.type === 'move_error') {
      const payload = message.payload as { error: string };
      setError(payload.error);
      setTimeout(() => setError(''), 3000);
    }
  }, []);

  const { send: roomSend, connectionState } = useColyseusRoom(
    'tic-tac-toe' as any,
    sessionState.status === 'ready' ? sessionState.session.session : null,
    colyseusUrl(),
    onMessage,
    (room) => {
      room.send('leave', {});
    },
  );

  function toMainMenu() {
    backToMenu();
    navigate('/games/tic-tac-toe', { replace: true });
  }

  if (sessionState.status === 'selecting-mode') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-accent">
            SELECT MODE
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={() => selectMode('single')}
            >
              VS BOT
            </button>
            <button
              type="button"
              className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
              onClick={() => selectMode('multi')}
            >
              VS PLAYER
            </button>
          </div>
          <button
            type="button"
            className="notch-6 border border-marquinhos-border bg-transparent px-5 py-3 text-sm font-semibold text-marquinhos-text transition hover:bg-marquinhos-panel-hover"
            onClick={() => navigate('/')}
          >
            BACK
          </button>
        </div>
      </div>
    );
  }

  if (sessionState.status === 'connecting') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-4 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
            CONNECTING…
          </div>
          <div className="max-w-[36ch] text-sm leading-6 text-marquinhos-text-dim">
            Establishing the session and preparing the game.
          </div>
        </div>
      </div>
    );
  }

  if (sessionState.status === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="notch-8 flex min-h-[240px] w-full max-w-[560px] flex-col items-center justify-center gap-5 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-danger">
            CONNECTION FAILED
          </div>
          <div className="max-w-[48ch] text-sm leading-6 text-marquinhos-text-dim">
            {sessionState.error}
          </div>
          <button
            type="button"
            className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
            onClick={toMainMenu}
          >
            BACK
          </button>
        </div>
      </div>
    );
  }

  const isGameOver = gameState.winner !== null || gameState.isDraw;
  const isMyTurn = gameState.currentPlayer === player;

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-marquinhos-text">
          {isGameOver
            ? gameState.winner
              ? `${gameState.winner === player ? 'YOU WIN!' : `PLAYER ${gameState.winner} WINS`}`
              : 'DRAW'
            : `${isMyTurn ? 'YOUR' : 'OPPONENT'} TURN (${gameState.currentPlayer})`}
        </div>
        <button
          type="button"
          className="notch-4 border border-marquinhos-border bg-transparent px-3 py-2 text-xs font-semibold text-marquinhos-text transition hover:bg-marquinhos-panel-hover"
          onClick={toMainMenu}
        >
          BACK
        </button>
      </div>

      {error && (
        <div className="notch-4 border border-marquinhos-danger bg-marquinhos-danger/10 px-4 py-2 text-sm text-marquinhos-danger">
          {error}
        </div>
      )}

      {(connectionState === 'disconnected' || connectionState === 'error') && (
        <div className="notch-4 border border-marquinhos-danger bg-marquinhos-danger/10 px-4 py-2 text-sm text-marquinhos-danger">
          CONNECTION LOST — RELOAD TO RECONNECT
        </div>
      )}

      <div className="flex-1 flex items-center justify-center">
        <TicTacToeCanvas
          state={gameState}
          player={player}
          onMove={(row, col) => {
            roomSend({ type: 'move', payload: { row, col } });
          }}
          gameOver={isGameOver}
        />
      </div>
    </div>
  );
}
