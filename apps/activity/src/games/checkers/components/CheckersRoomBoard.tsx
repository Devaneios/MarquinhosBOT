import {
  serverMessageSchema,
  type CheckersClientMessage,
} from '@marquinhos/contracts/activity/games/checkers';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import { useEffect, useState } from 'react';
import { useRoomConnectionContext } from '../../shared/RoomConnectionProvider';
import { applyCheckersMessage, initialCheckersView } from '../checkersMessages';
import { CheckersCanvas } from './CheckersCanvas';

// Renders the Checkers board inside a multiplayer Room view — driven by
// RoomConnectionContext instead of CheckersBoard's own useColyseusRoom call.
export function CheckersRoomBoard() {
  const ctx = useRoomConnectionContext();
  const [view, setView] = useState(initialCheckersView);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((raw) => {
      const message = parseMessage(serverMessageSchema, raw);
      if (message) setView((current) => applyCheckersMessage(current, message));
    });
  }, [ctx]);

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <CheckersCanvas
        state={view.state}
        myColor={view.myColor}
        role={ctx?.role ?? null}
        onMove={(from, to) =>
          ctx?.send({
            type: 'move',
            payload: { from, to },
          } satisfies CheckersClientMessage)
        }
        clearSelectionSignal={view.clearSelectionSignal}
      />
    </div>
  );
}
