import {
  serverMessageSchema,
  type TicTacToeClientMessage,
} from '@marquinhos/contracts/activity/games/ticTacToe';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import { useEffect, useState } from 'react';
import { useRoomConnectionContext } from '../../shared/RoomConnectionProvider';
import {
  applyTicTacToeMessage,
  initialTicTacToeView,
} from '../ticTacToeMessages';
import { TicTacToeCanvas } from './TicTacToeCanvas';

// Renders the Tic-Tac-Toe board inside a multiplayer Room view — driven by
// RoomConnectionContext (the room's one shared connection) instead of
// TicTacToeGame's own useColyseusRoom call, sharing applyTicTacToeMessage
// with the standalone path.
export function TicTacToeRoomBoard() {
  const ctx = useRoomConnectionContext();
  const [view, setView] = useState(initialTicTacToeView);
  const { state: gameState, player, error } = view;

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((raw) => {
      const message = parseMessage(serverMessageSchema, raw);
      if (message)
        setView((current) => applyTicTacToeMessage(current, message));
    });
  }, [ctx]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(
      () => setView((current) => ({ ...current, error: '' })),
      3000,
    );
    return () => clearTimeout(timer);
  }, [error]);

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
        onMove={(row, col) =>
          ctx?.send({
            type: 'move',
            payload: { row, col },
          } satisfies TicTacToeClientMessage)
        }
      />
    </div>
  );
}
