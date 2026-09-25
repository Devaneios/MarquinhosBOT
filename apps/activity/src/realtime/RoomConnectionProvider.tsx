import type { Room } from '@colyseus/sdk';
import type { GameId } from '@marquinhos/contracts/activity/gameId';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import {
  ROOM_STATE,
  roomServerMessageSchema,
  type RoomState,
} from '@marquinhos/contracts/activity/room';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DiscordIdentity } from '../discord/auth.ts';
import { colyseusUrl } from '../lib/apiBase';
import { devwarn } from '../lib/devlog';
import {
  connectToRoom,
  wireRoomLifecycle,
  type ActivityMessage,
  type ColyseusConnectionState,
} from './colyseusConnection';
import type { WsSession } from './gameSession';
import { RoomConnectionContext } from './RoomConnectionContext';

type Listener = (message: ActivityMessage) => void;

// Generous for the few frames between room_state and the board's subscribe;
// only a game without a room board could ever fill it.
const MAX_BACKLOG = 256;

interface Backlog {
  game: GameId | null;
  // null once handed over: later messages reach the board live.
  messages: ActivityMessage[] | null;
  lateListeners: Set<Listener>;
  flushScheduled: boolean;
}

function openBacklog(): Backlog {
  return {
    game: null,
    messages: [],
    lateListeners: new Set(),
    flushScheduled: false,
  };
}

// The first room_state only names the game: messages already held belong to
// it. A later one naming another game (switch_game) starts a fresh backlog
// for the board that game will mount.
function reopenBacklogOnGameChange(backlog: Backlog, game: GameId) {
  if (backlog.game === game) return;
  if (backlog.game !== null) {
    backlog.messages = [];
    backlog.lateListeners.clear();
    backlog.flushScheduled = false;
  }
  backlog.game = game;
}

function flushBacklog(backlog: Backlog, listeners: ReadonlySet<Listener>) {
  const messages = backlog.messages ?? [];
  backlog.messages = null;
  for (const listener of backlog.lateListeners) {
    if (!listeners.has(listener)) continue;
    for (const message of messages) listener(message);
  }
  backlog.lateListeners.clear();
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
  const listenersRef = useRef(new Set<Listener>());
  // A game's board mounts only once room_state naming that game has
  // rendered, so its `init` usually arrives before anyone listens for it.
  // Game messages are held here from that room_state until the board's
  // render subscribes, then handed to the listeners that joined since.
  const backlogRef = useRef<Backlog>(openBacklog());
  const [connectionState, setConnectionState] =
    useState<ColyseusConnectionState>('connecting');
  const [roomState, setRoomState] = useState<RoomState | null>(null);

  useEffect(() => {
    let cancelled = false;
    backlogRef.current = openBacklog();
    setConnectionState('connecting');

    connectToRoom(game, session, colyseusUrl(), (message) => {
      if (message.type === ROOM_STATE) {
        const parsed = parseMessage(roomServerMessageSchema, message);
        if (parsed?.type === ROOM_STATE) {
          reopenBacklogOnGameChange(backlogRef.current, parsed.payload.game);
          setRoomState(parsed.payload);
        } else devwarn('[room] ignoring malformed room state', message.payload);
        return;
      }
      listenersRef.current.forEach((listener) => listener(message));
      const backlog = backlogRef.current;
      if (backlog.messages && backlog.messages.length < MAX_BACKLOG)
        backlog.messages.push(message);
    })
      .then((room) => {
        if (cancelled) {
          room.leave(true).catch(() => undefined);
          return;
        }
        roomRef.current = room;
        setConnectionState('connected');
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

  const subscribe = (onMessage: Listener) => {
    listenersRef.current.add(onMessage);
    const backlog = backlogRef.current;
    if (backlog.messages) {
      backlog.lateListeners.add(onMessage);
      // Subscribing from a render that shows the backlog's game means that
      // game's board is mounted; every listener joining in this same effect
      // flush gets the backlog, then it closes.
      const boardMounted =
        connectionState === 'connected' && roomState?.game === backlog.game;
      if (boardMounted && !backlog.flushScheduled) {
        backlog.flushScheduled = true;
        queueMicrotask(() => flushBacklog(backlog, listenersRef.current));
      }
    }
    return () => {
      listenersRef.current.delete(onMessage);
    };
  };

  const role =
    roomState?.members.find((m) => m.userId === identity.userId)?.role ?? null;
  const isHost = roomState?.hostUserId === identity.userId;

  return (
    <RoomConnectionContext.Provider
      value={{
        send,
        connectionState,
        roomState,
        role,
        currentUserId: identity.userId,
        isHost,
        subscribe,
      }}
    >
      {children}
    </RoomConnectionContext.Provider>
  );
}
