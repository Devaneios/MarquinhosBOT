import { Client, type Room } from '@colyseus/sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameId } from '../gameId';
import type { WsSession } from './activitySession';

export interface ActivityMessage {
  type: string;
  payload?: unknown;
}

// 'connecting'/'connected' track the join itself; 'disconnected' means the
// room connection dropped after a successful join (server restart, network
// drop); 'error' covers both a rejected join and a room.onError callback.
// Callers decide what to render for each — this hook only tracks the state.
export type ColyseusConnectionState =
  'connecting' | 'connected' | 'disconnected' | 'error';

// Extracted from the hook (mirrors useDiscordIdentity's runAuthFlow) so the
// connect/message-forwarding logic is testable without rendering a
// component — the hook below is a thin React lifecycle wrapper around it.
export function connectToRoom(
  game: GameId,
  session: WsSession,
  endpoint: string,
  onMessage: (message: ActivityMessage) => void,
): Promise<Room> {
  const client = new Client(endpoint);
  return client
    .joinOrCreate(game, { token: session.token, roomKey: session.roomKey })
    .then((room) => {
      room.onMessage('*', (type, payload) =>
        onMessage({ type: String(type), payload }),
      );
      return room;
    });
}

// Replaces useActivitySocket: same {send} interface, but the connection,
// reconnection and message dispatch are all handled by @colyseus/sdk's own
// Room/Client instead of a hand-rolled WebSocket wrapper.
//
// `onBeforeLeave` (if given) runs synchronously right before the room is
// torn down on unmount/session-change — e.g. Pong uses it to send a 'leave'
// message so the server forfeits the match immediately instead of treating
// the socket close as a transient network drop.
export function useColyseusRoom(
  game: GameId,
  session: WsSession | null,
  endpoint: string,
  onMessage: (message: ActivityMessage) => void,
  onBeforeLeave?: (room: Room) => void,
): {
  send: (message: ActivityMessage) => void;
  connectionState: ColyseusConnectionState;
} {
  const roomRef = useRef<Room | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onBeforeLeaveRef = useRef(onBeforeLeave);
  onBeforeLeaveRef.current = onBeforeLeave;
  const [connectionState, setConnectionState] =
    useState<ColyseusConnectionState>('connecting');

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setConnectionState('connecting');

    connectToRoom(game, session, endpoint, (message) =>
      onMessageRef.current(message),
    )
      .then((room) => {
        if (cancelled) {
          room.leave(true);
          return;
        }
        roomRef.current = room;
        setConnectionState('connected');
        room.onLeave(() => {
          if (cancelled) return;
          setConnectionState('disconnected');
        });
        room.onError(() => {
          if (cancelled) return;
          setConnectionState('error');
        });
      })
      .catch(() => {
        if (cancelled) return;
        setConnectionState('error');
      });

    return () => {
      cancelled = true;
      if (roomRef.current) {
        onBeforeLeaveRef.current?.(roomRef.current);
        roomRef.current.leave(true);
      }
      roomRef.current = null;
    };
  }, [game, session?.token, session?.roomKey, endpoint]);

  const send = useCallback((message: ActivityMessage) => {
    roomRef.current?.send(message.type, message.payload);
  }, []);

  return { send, connectionState };
}
