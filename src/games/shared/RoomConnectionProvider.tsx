import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Room } from '@colyseus/sdk';
import type { DiscordIdentity } from '../../discordAuth.ts';
import type { GameId } from '../gameId';
import { colyseusUrl } from '../../lib/apiBase';
import { devwarn } from '../../lib/devlog';
import {
  connectToRoom,
  wireRoomLifecycle,
  type ActivityMessage,
  type ColyseusConnectionState,
} from './colyseusConnection';
import type { WsSession } from './activitySession';

export interface RoomMember {
  userId: string;
  role: 'player' | 'spectator' | 'queued';
}

export interface RoomState {
  game: GameId;
  hostUserId: string;
  queueEnabled: boolean;
  matchInProgress: boolean;
  members: RoomMember[];
}

interface RoomConnectionContextValue {
  send: (message: ActivityMessage) => void;
  connectionState: ColyseusConnectionState;
  roomState: RoomState | null;
  role: RoomMember['role'] | null;
  currentUserId: string;
  isHost: boolean;
  subscribe: (onMessage: (message: ActivityMessage) => void) => () => void;
}

// Exported (not just the hook below) so tests can wrap components directly
// with a fixed context value, without spinning up a real provider/connection.
export const RoomConnectionContext = createContext<RoomConnectionContextValue | null>(null);

export function useRoomConnectionContext(): RoomConnectionContextValue | null {
  return useContext(RoomConnectionContext);
}

export function RoomConnectionProvider({
  roomId,
  session,
  game,
  identity,
  children,
}: {
  roomId: string;
  session: WsSession;
  game: GameId;
  queueEnabled: boolean;
  identity: DiscordIdentity;
  children: ReactNode;
}) {
  const roomRef = useRef<Room | null>(null);
  const listenersRef = useRef(new Set<(message: ActivityMessage) => void>());
  const [connectionState, setConnectionState] = useState<ColyseusConnectionState>('connecting');
  const [roomState, setRoomState] = useState<RoomState | null>(null);

  useEffect(() => {
    let cancelled = false;
    setConnectionState('connecting');

    connectToRoom(game, session, colyseusUrl(), (message) => {
      listenersRef.current.forEach((listener) => listener(message));
    })
      .then((room) => {
        if (cancelled) return;
        roomRef.current = room;
        setConnectionState('connected');
        room.onStateChange((state: unknown) => setRoomState(state as RoomState));
        wireRoomLifecycle(room, game, (state) => {
          if (!cancelled) setConnectionState(state);
        });
      })
      .catch((err) => {
        if (cancelled) return;
        devwarn('[room] join failed', err);
        setConnectionState('error');
      });

    return () => {
      cancelled = true;
      roomRef.current?.leave(true).catch(() => undefined);
      roomRef.current = null;
    };
    // Intentionally runs once per mounted provider instance, keyed only on
    // roomId — a provider unmount/remount (leaving the room view entirely)
    // is the only thing that should tear down and reconnect. game/session
    // changing while roomId stays the same happens via switch_game, which
    // is a server-driven state change on the SAME connection, not a
    // reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const send = (message: ActivityMessage) => {
    roomRef.current?.send(message.type, message.payload);
  };

  const subscribe = (onMessage: (message: ActivityMessage) => void) => {
    listenersRef.current.add(onMessage);
    return () => {
      listenersRef.current.delete(onMessage);
    };
  };

  const role = roomState?.members.find((m) => m.userId === identity.userId)?.role ?? null;
  const isHost = roomState?.hostUserId === identity.userId;

  return (
    <RoomConnectionContext.Provider
      value={{ send, connectionState, roomState, role, currentUserId: identity.userId, isHost, subscribe }}
    >
      {children}
    </RoomConnectionContext.Provider>
  );
}
