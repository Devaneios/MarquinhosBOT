import {
  serverMessageSchema,
  type ConnectFourClientMessage,
} from '@marquinhos/contracts/activity/games/connectFour';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import { useEffect, useState } from 'react';
import { useRoomConnectionContext } from '../../../realtime/RoomConnectionProvider';
import {
  applyConnectFourMessage,
  initialConnectFourView,
} from '../connectFourMessages';
import { ConnectFourCanvas } from './ConnectFourCanvas';

// Renders the Connect Four board inside a multiplayer Room view — driven by
// RoomConnectionContext instead of ConnectFourBoard's own useColyseusRoom
// call, mirroring the same init/state/opponent_*/restart_status message
// handling ConnectFourBoard.tsx already does for the standalone path.
//
// Gating is on `ctx.role`, not just the server-assigned `disc` (which is
// null for non-players anyway): `mySide` starts as `null` here, so a fresh
// mount is already safe, but role is the one signal RoomConnectionProvider
// keeps live across a mid-room seat change (rotate_seat) that doesn't
// remount this component the way a switch_game does — trust it over the
// message-derived local state for the interactive gate.
export function ConnectFourRoomBoard() {
  const ctx = useRoomConnectionContext();
  const [view, setView] = useState(initialConnectFourView);
  const { mySide, state } = view;

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((raw) => {
      const message = parseMessage(serverMessageSchema, raw);
      if (message)
        setView((current) => applyConnectFourMessage(current, message));
    });
  }, [ctx]);

  const isMyTurn =
    !!state && !state.winner && !state.isDraw && mySide === state.currentTurn;
  const role = ctx?.role ?? null;
  const interactive = isMyTurn && role !== 'spectator' && role !== 'queued';

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <ConnectFourCanvas
        state={state}
        interactive={interactive}
        onDrop={(col) =>
          ctx?.send({
            type: 'drop',
            payload: { col },
          } satisfies ConnectFourClientMessage)
        }
      />
    </div>
  );
}
