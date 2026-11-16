import { devwarn } from '@/shared/logging/devlog';
import type { Room } from '@colyseus/sdk';
import type { GameId } from '@marquinhos/contracts/activity/gameId';
import type { WsSession } from '@marquinhos/contracts/http/routes/activity';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import {
  connectToRoom,
  wireRoomLifecycle,
  type ActivityMessage,
  type ColyseusConnectionState,
} from './connection';
import { useRoomConnectionContext } from './RoomConnectionContext';

interface PooledRoom {
  promise: Promise<Room>;
  refs: number;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  messages: Set<(message: ActivityMessage) => void>;
  states: Set<(state: ColyseusConnectionState) => void>;
}

const roomPool = new Map<string, PooledRoom>();

function acquireRoom(
  key: string,
  game: GameId,
  connect: (deliver: (message: ActivityMessage) => void) => Promise<Room>,
  message: (message: ActivityMessage) => void,
  state: (state: ColyseusConnectionState) => void,
): { entry: PooledRoom; reused: boolean } {
  const existing = roomPool.get(key);
  if (existing) {
    existing.refs += 1;
    existing.messages.add(message);
    existing.states.add(state);
    if (existing.cleanupTimer) clearTimeout(existing.cleanupTimer);
    existing.cleanupTimer = null;
    return { entry: existing, reused: true };
  }
  const messages = new Set([message]);
  const states = new Set([state]);
  const entry: PooledRoom = {
    promise: connect((incoming) => {
      for (const listener of messages) listener(incoming);
    }).then((room) => {
      wireRoomLifecycle(room, game, (next) => {
        if (next === 'disconnected' && roomPool.get(key) === entry) {
          roomPool.delete(key);
        }
        for (const listener of states) listener(next);
      });
      return room;
    }),
    refs: 1,
    cleanupTimer: null,
    messages,
    states,
  };
  roomPool.set(key, entry);
  entry.promise.catch(() => {
    if (roomPool.get(key) === entry) roomPool.delete(key);
  });
  return { entry, reused: false };
}

function releaseRoom(
  key: string,
  entry: PooledRoom,
  message: (message: ActivityMessage) => void,
  state: (state: ColyseusConnectionState) => void,
  onBeforeLeave?: (room: Room) => void,
): void {
  entry.messages.delete(message);
  entry.states.delete(state);
  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0) return;
  entry.cleanupTimer = setTimeout(() => {
    if (entry.refs > 0) return;
    if (roomPool.get(key) === entry) roomPool.delete(key);
    entry.promise
      .then((room) => {
        onBeforeLeave?.(room);
        return room.leave(true);
      })
      .catch(() => undefined);
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
  const handleMessage = useEffectEvent(onMessage);

  useEffect(() => {
    if (!roomContext) return;
    return roomContext.subscribe((message) => handleMessage(message));
  }, [roomContext]);

  const roomRef = useRef<Room | null>(null);
  const beforeLeave = useEffectEvent((room: Room) => onBeforeLeave?.(room));
  const [connection, setConnection] = useState<{
    game: GameId;
    session: WsSession | null;
    endpoint: string;
    state: ColyseusConnectionState;
  }>({
    game,
    session,
    endpoint,
    state: 'connecting',
  });

  useEffect(() => {
    if (roomContext) return; // shared-connection path handled above
    if (!session) return;
    let cancelled = false;

    const poolKey = `${endpoint}:${game}:${session.roomKey}:${session.token}`;
    const onRoomMessage = (message: ActivityMessage) => handleMessage(message);
    const onRoomState = (state: ColyseusConnectionState) => {
      if (!cancelled) setConnection({ game, session, endpoint, state });
    };
    const { entry: pooled, reused } = acquireRoom(
      poolKey,
      game,
      (deliver) => connectToRoom(game, session, endpoint, deliver),
      onRoomMessage,
      onRoomState,
    );
    pooled.promise
      .then((room) => {
        if (cancelled) return;
        roomRef.current = room;
        setConnection({ game, session, endpoint, state: 'connected' });
        if (reused && game === 'wordle') room.send('wordle_sync');
      })
      .catch((err) => {
        if (cancelled) return;
        devwarn('[colyseus] join failed', err);
        setConnection({ game, session, endpoint, state: 'error' });
      });

    return () => {
      cancelled = true;
      releaseRoom(poolKey, pooled, onRoomMessage, onRoomState, beforeLeave);
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
    connectionState: roomContext
      ? roomContext.connectionState
      : connection.game === game &&
          connection.session === session &&
          connection.endpoint === endpoint
        ? connection.state
        : 'connecting',
    role: roomContext ? roomContext.role : null,
  };
}
