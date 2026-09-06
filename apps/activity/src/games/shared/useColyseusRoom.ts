import type { Room } from '@colyseus/sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import { devwarn } from '../../lib/devlog';
import type { GameId } from '../gameId';
import type { WsSession } from './activitySession';
import {
  connectToRoom,
  wireRoomLifecycle,
  type ActivityMessage,
  type ColyseusConnectionState,
} from './colyseusConnection';
import { useRoomConnectionContext } from './RoomConnectionProvider';

// Re-exported for existing call sites/tests that import these from this
// file — the implementations now live in colyseusConnection.ts, shared with
// RoomConnectionProvider, to avoid a circular import between the two.
export { connectToRoom, wireRoomLifecycle };
export type { ActivityMessage, ColyseusConnectionState };

interface PooledRoom {
  promise: Promise<Room>;
  refs: number;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

const roomPool = new Map<string, PooledRoom>();

function acquireRoom(key: string, connect: () => Promise<Room>): PooledRoom {
  const existing = roomPool.get(key);
  if (existing) {
    existing.refs += 1;
    if (existing.cleanupTimer) clearTimeout(existing.cleanupTimer);
    existing.cleanupTimer = null;
    return existing;
  }
  const entry: PooledRoom = {
    promise: connect(),
    refs: 1,
    cleanupTimer: null,
  };
  roomPool.set(key, entry);
  return entry;
}

function releaseRoom(key: string, onBeforeLeave?: (room: Room) => void): void {
  const entry = roomPool.get(key);
  if (!entry) return;
  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0) return;
  entry.cleanupTimer = setTimeout(() => {
    if (entry.refs > 0) return;
    entry.promise
      .then((room) => {
        onBeforeLeave?.(room);
        return room.leave(true);
      })
      .catch(() => undefined)
      .finally(() => roomPool.delete(key));
  }, 100);
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
  role: 'player' | 'spectator' | 'queued' | null;
} {
  // Inside a RoomConnectionProvider (room-based multi mode): subscribe to
  // the one shared connection the provider owns, never establish our own —
  // this is what lets a room survive a host's switch_game without every
  // board tearing down and reconnecting. Outside one (single/local mode):
  // unchanged behavior below, this hook owns its own connection as before.
  const roomContext = useRoomConnectionContext();
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!roomContext) return;
    return roomContext.subscribe((message) => onMessageRef.current(message));
  }, [roomContext]);

  const roomRef = useRef<Room | null>(null);
  const onBeforeLeaveRef = useRef(onBeforeLeave);
  onBeforeLeaveRef.current = onBeforeLeave;
  const [connectionState, setConnectionState] =
    useState<ColyseusConnectionState>('connecting');

  useEffect(() => {
    if (roomContext) return; // shared-connection path handled above
    if (!session) return;
    let cancelled = false;
    setConnectionState('connecting');

    const poolKey = `${endpoint}:${game}:${session.roomKey}:${session.token}`;
    const pooled = acquireRoom(poolKey, () =>
      connectToRoom(game, session, endpoint, (message) =>
        onMessageRef.current(message),
      ),
    );
    pooled.promise
      .then((room) => {
        if (cancelled) return;
        roomRef.current = room;
        setConnectionState('connected');
        wireRoomLifecycle(room, game, (state) => {
          if (!cancelled) setConnectionState(state);
        });
      })
      .catch((err) => {
        if (cancelled) return;
        devwarn('[colyseus] join failed', err);
        setConnectionState('error');
      });

    return () => {
      cancelled = true;
      releaseRoom(poolKey, onBeforeLeaveRef.current);
      roomRef.current = null;
    };
  }, [game, session, endpoint, roomContext]);

  const send = useCallback(
    (message: ActivityMessage) => {
      if (roomContext) {
        roomContext.send(message);
        return;
      }
      roomRef.current?.send(message.type, message.payload);
    },
    [roomContext],
  );

  return {
    send,
    connectionState: roomContext ? roomContext.connectionState : connectionState,
    role: roomContext ? roomContext.role : null,
  };
}
