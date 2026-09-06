import { useEffect, useState } from 'react';
import { useRoomConnectionContext } from '../../shared/RoomConnectionProvider';
import type { ConnectFourState, Disc } from '../types';
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
  const [mySide, setMySide] = useState<Disc | null>(null);
  const [state, setState] = useState<ConnectFourState | null>(null);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((message) => {
      if (message.type === 'init') {
        const payload = message.payload as { disc: Disc | null; state: ConnectFourState };
        setMySide(payload.disc);
        setState(payload.state);
      } else if (message.type === 'state') {
        setState(message.payload as ConnectFourState);
      }
    });
  }, [ctx]);

  const isMyTurn = !!state && !state.winner && !state.isDraw && mySide === state.currentTurn;
  const role = ctx?.role ?? null;
  const interactive = isMyTurn && role !== 'spectator' && role !== 'queued';

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <ConnectFourCanvas
        state={state}
        interactive={interactive}
        onDrop={(col) => ctx?.send({ type: 'drop', payload: { col } })}
      />
    </div>
  );
}
