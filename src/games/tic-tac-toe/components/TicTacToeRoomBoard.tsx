import { useEffect, useState } from 'react';
import { useRoomConnectionContext } from '../../shared/RoomConnectionProvider';
import type { TicTacToeState } from '../hooks/useTicTacToeSession';
import { TicTacToeCanvas } from './TicTacToeCanvas';

const EMPTY_BOARD: TicTacToeState = {
  board: [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ],
  currentPlayer: 'X',
  winner: null,
  isDraw: false,
  moveCount: 0,
};

// Renders the Tic-Tac-Toe board inside a multiplayer Room view — driven by
// RoomConnectionContext (the room's one shared connection) instead of
// TicTacToeGame's own useColyseusRoom call, mirroring the same
// init/state_update/action_rejected message handling TicTacToeGame.tsx
// already does for the standalone path.
export function TicTacToeRoomBoard() {
  const ctx = useRoomConnectionContext();
  const [gameState, setGameState] = useState<TicTacToeState>(EMPTY_BOARD);
  const [player, setPlayer] = useState<string>('X');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((message) => {
      if (message.type === 'init') {
        const payload = message.payload as { player: string; state: TicTacToeState };
        setPlayer(payload.player);
        setGameState(payload.state);
      } else if (message.type === 'state_update') {
        setGameState(message.payload as TicTacToeState);
      } else if (message.type === 'action_rejected') {
        const payload = message.payload as { error: string };
        setError(payload.error);
        setTimeout(() => setError(''), 3000);
      }
    });
  }, [ctx]);

  const isGameOver = gameState.winner !== null || gameState.isDraw;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      {error && (
        <div className="notch-4 border border-marquinhos-danger bg-marquinhos-danger/10 px-4 py-2 text-sm text-marquinhos-danger">
          {error}
        </div>
      )}
      <TicTacToeCanvas
        state={gameState}
        player={player}
        role={ctx?.role ?? null}
        gameOver={isGameOver}
        onMove={(row, col) => ctx?.send({ type: 'move', payload: { row, col } })}
      />
    </div>
  );
}
