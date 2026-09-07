import { useEffect, useState } from 'react';
import { useRoomConnectionContext } from '../../shared/RoomConnectionProvider';
import type { CheckersState, Color } from '../types';
import { CheckersCanvas } from './CheckersCanvas';

// Renders the Checkers board inside a multiplayer Room view — driven by
// RoomConnectionContext instead of CheckersBoard's own useColyseusRoom call.
export function CheckersRoomBoard() {
  const ctx = useRoomConnectionContext();
  const [myColor, setMyColor] = useState<Color | null>(null);
  const [state, setState] = useState<CheckersState | null>(null);
  const [clearSelectionSignal, setClearSelectionSignal] = useState(0);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((message) => {
      if (message.type === 'init') {
        const payload = message.payload as {
          color: Color | null;
          state: CheckersState;
        };
        setMyColor(payload.color);
        setState(payload.state);
      } else if (message.type === 'state') {
        setState(message.payload as CheckersState);
      } else if (message.type === 'action_rejected') {
        // checkersAdapter.ts sends ACTION_REJECTED for a rejected move — see
        // the matching note in CheckersBoard.tsx.
        setClearSelectionSignal((n) => n + 1);
      }
    });
  }, [ctx]);

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <CheckersCanvas
        state={state}
        myColor={myColor}
        role={ctx?.role ?? null}
        onMove={(from, to) =>
          ctx?.send({ type: 'move', payload: { from, to } })
        }
        clearSelectionSignal={clearSelectionSignal}
      />
    </div>
  );
}
