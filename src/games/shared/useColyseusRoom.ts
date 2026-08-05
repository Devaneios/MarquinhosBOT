import { Client, type Room } from '@colyseus/sdk';
import { useCallback, useEffect, useRef } from 'react';
import type { GameId } from '../gameId';
import type { WsSession } from './activitySession';

export interface ActivityMessage {
  type: string;
  payload?: unknown;
}

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
export function useColyseusRoom(
  game: GameId,
  session: WsSession | null,
  endpoint: string,
  onMessage: (message: ActivityMessage) => void,
): { send: (message: ActivityMessage) => void } {
  const roomRef = useRef<Room | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    connectToRoom(game, session, endpoint, (message) =>
      onMessageRef.current(message),
    )
      .then((room) => {
        if (cancelled) {
          room.leave(true);
          return;
        }
        roomRef.current = room;
      })
      .catch(() => {
        // Left to the caller: it already tracks connection state from
        // fetchWsSessionToken and checks isAuthError on failure there.
      });

    return () => {
      cancelled = true;
      roomRef.current?.leave(true);
      roomRef.current = null;
    };
  }, [game, session?.token, session?.roomKey, endpoint]);

  const send = useCallback((message: ActivityMessage) => {
    roomRef.current?.send(message.type, message.payload);
  }, []);

  return { send };
}
