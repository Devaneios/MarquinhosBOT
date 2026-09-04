import { Client, type Room } from '@colyseus/sdk';
import { devinfo, devwarn } from '../../lib/devlog';
import type { GameId } from '../gameId';
import type { WsSession } from './activitySession';

export interface ActivityMessage {
  type: string;
  payload?: unknown;
}

// 'connecting'/'connected' track the join itself; 'disconnected' means the
// room connection dropped for good (consented leave, reconnection disabled,
// or the SDK's built-in reconnection exhausted its retries — see onLeave
// below); 'error' covers a rejected join. A transient network drop does NOT
// move us to 'disconnected': @colyseus/sdk retries the connection on its own
// (room.onDrop/room.onReconnect) and we stay 'connected' while that's in
// flight so the UI doesn't flash a "connection lost" banner for blips that
// self-heal. Callers decide what to render for each — this hook only tracks
// the state.
export type ColyseusConnectionState =
  'connecting' | 'connected' | 'disconnected' | 'error';

// Extracted from useColyseusRoom (mirrors useDiscordIdentity's runAuthFlow)
// so the connect/message-forwarding logic is testable without rendering a
// component, and shared between useColyseusRoom (single/local mode, owns its
// own connection) and RoomConnectionProvider (room-based multi mode, owns
// one shared connection for the whole room) without either importing from
// the other.
export function connectToRoom(
  game: GameId,
  session: WsSession,
  endpoint: string,
  onMessage: (message: ActivityMessage) => void,
): Promise<Room> {
  const client = new Client(endpoint);
  return client
    .joinOrCreate('match', { token: session.token, roomKey: session.roomKey, game })
    .then((room) => {
      room.onMessage('*', (type, payload) =>
        onMessage({ type: String(type), payload }),
      );
      if (game === 'pong') room.send('sync');
      return room;
    });
}

// Extracted for the same reason as connectToRoom: testable without
// rendering. Wires up the SDK's post-join lifecycle signals on an already
// joined room — the caller decides what to do with each connectionState
// value (including guarding against a stale/cancelled effect).
export function wireRoomLifecycle(
  room: Room,
  game: GameId,
  onConnectionStateChange: (state: ColyseusConnectionState) => void,
): void {
  devinfo('[colyseus] joined room', game, room.roomId);

  // Transient drop: @colyseus/sdk is retrying the connection on its own
  // (exponential backoff, see Room.retryReconnection). We stay 'connected'
  // during this window instead of flashing an error — the state only moves
  // on genuine terminal outcomes below.
  room.onDrop((code, reason) => {
    devwarn('[colyseus] connection dropped, retrying...', code, reason);
  });
  room.onReconnect(() => {
    devinfo('[colyseus] reconnected');
    onConnectionStateChange('connected');
  });
  // onLeave only fires for a genuinely terminal disconnect: consented
  // leave, reconnection disabled, room uptime too short to retry, or the
  // SDK exhausted its retries after a drop.
  room.onLeave((code, reason) => {
    devwarn('[colyseus] left room', code, reason);
    onConnectionStateChange('disconnected');
  });
  // Transport-level errors always precede a close event (handled by
  // onDrop/onLeave above), so we only log here for visibility instead of
  // transitioning state — acting on it would race the SDK's own
  // reconnection decision and show a false "connection lost" banner.
  room.onError((code, message) => {
    devwarn('[colyseus] room error', code, message);
  });
}
