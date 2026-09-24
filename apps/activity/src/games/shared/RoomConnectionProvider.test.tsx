import { act, render, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, mock } from 'bun:test';
import { useEffect, type ReactNode } from 'react';
import type { ActivityMessage } from './colyseusConnection';
import { fakeRoom } from './useColyseusRoom.test';
// Static import, deliberately NOT cache-busted with a random query string:
// useColyseusRoom.ts itself statically imports RoomConnectionProvider (no
// query param either), so importing it here with a *different* dynamic
// specifier would resolve to a second, distinct module instance — a second
// createContext() call producing a context object useColyseusRoom's
// useContext() call could never see a value from. Importing it exactly the
// way useColyseusRoom.ts does keeps both resolving to the same instance.
import {
  RoomConnectionProvider,
  useRoomConnectionContext,
} from './RoomConnectionProvider';

async function freshUseColyseusRoom(room: ReturnType<typeof fakeRoom>) {
  const joinOrCreate = mock(
    async (_roomType: string, _options: unknown) => room,
  );
  mock.module('@colyseus/sdk', () => ({
    Client: class {
      joinOrCreate = joinOrCreate;
    },
  }));
  mock.module('../../lib/apiBase', () => ({
    apiBase: () => 'http://fake.test/api',
    apiUrl: (path: string) => `http://fake.test/api${path}`,
    colyseusUrl: () => 'ws://fake.test',
  }));
  // Only useColyseusRoom.ts needs cache-busting between tests — it holds
  // module-level mutable state (roomPool) that would otherwise leak across
  // tests. RoomConnectionProvider has no such state; all of its state lives
  // inside the React component instance, which each test's own render
  // already isolates.
  const hookMod = await import(`./useColyseusRoom.ts?${Math.random()}`);
  return { useColyseusRoom: hookMod.useColyseusRoom, joinOrCreate };
}

const identity = {
  userId: 'user-a',
  guildId: 'g',
  instanceId: 'i',
  accessToken: 'x',
};
const session = { token: 't', roomKey: 'k' };

describe('RoomConnectionProvider + useColyseusRoom', () => {
  it('a board using useColyseusRoom inside the provider receives messages and role from the one shared connection', async () => {
    const room = fakeRoom();
    const { useColyseusRoom, joinOrCreate } = await freshUseColyseusRoom(room);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <RoomConnectionProvider
        roomId="ROOM01"
        session={session}
        game="tic-tac-toe"
        queueEnabled={false}
        identity={identity}
      >
        {children}
      </RoomConnectionProvider>
    );

    const messages: unknown[] = [];
    const { result } = renderHook(
      () =>
        useColyseusRoom('tic-tac-toe', session, 'ws://x', (m: unknown) =>
          messages.push(m),
        ),
      { wrapper },
    );

    await waitFor(() =>
      expect(result.current.connectionState).toBe('connected'),
    );
    expect(joinOrCreate).toHaveBeenCalledTimes(1);

    act(() => {
      room.emit('room_state', {
        game: 'tic-tac-toe',
        hostUserId: 'user-a',
        queueEnabled: false,
        matchInProgress: false,
        members: [{ userId: 'user-a', role: 'player' }],
      });
    });

    await waitFor(() => expect(result.current.role).toBe('player'));

    act(() => {
      room.emit('state_update', { foo: 'bar' });
    });
    expect(messages).toEqual([
      { type: 'state_update', payload: { foo: 'bar' } },
    ]);
  });

  it('does not establish its own connection when inside the provider (only the provider calls joinOrCreate)', async () => {
    const room = fakeRoom();
    const { useColyseusRoom, joinOrCreate } = await freshUseColyseusRoom(room);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <RoomConnectionProvider
        roomId="ROOM02"
        session={session}
        game="tic-tac-toe"
        queueEnabled={false}
        identity={identity}
      >
        {children}
      </RoomConnectionProvider>
    );

    renderHook(
      () => useColyseusRoom('tic-tac-toe', session, 'ws://x', () => {}),
      { wrapper },
    );

    await waitFor(() => expect(joinOrCreate).toHaveBeenCalledTimes(1));
    // The hook itself never calls joinOrCreate a second time even though it
    // was given its own session/endpoint args — those are ignored in favor
    // of the shared connection.
    expect(joinOrCreate).toHaveBeenCalledTimes(1);
  });

  it('send() routes through the shared connection, not a hook-local one', async () => {
    const room = fakeRoom();
    const { useColyseusRoom } = await freshUseColyseusRoom(room);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <RoomConnectionProvider
        roomId="ROOM03"
        session={session}
        game="tic-tac-toe"
        queueEnabled={false}
        identity={identity}
      >
        {children}
      </RoomConnectionProvider>
    );

    const { result } = renderHook(
      () => useColyseusRoom('tic-tac-toe', session, 'ws://x', () => {}),
      { wrapper },
    );

    await waitFor(() =>
      expect(result.current.connectionState).toBe('connected'),
    );
    result.current.send({ type: 'move', payload: { row: 0, col: 0 } });

    expect(room.send).toHaveBeenCalledWith('move', { row: 0, col: 0 });
  });

  it('outside a provider, useColyseusRoom behaves exactly as before (role is null, establishes its own connection)', async () => {
    const room = fakeRoom();
    const { useColyseusRoom, joinOrCreate } = await freshUseColyseusRoom(room);

    const { result } = renderHook(() =>
      useColyseusRoom('tic-tac-toe', session, 'ws://x', () => {}),
    );

    await waitFor(() =>
      expect(result.current.connectionState).toBe('connected'),
    );
    expect(result.current.role).toBe(null);
    expect(joinOrCreate).toHaveBeenCalledTimes(1);
  });
});

// Mirrors RoomView: a board mounts only once room_state names its game, and
// a different game remounts it.
function LateBoards({
  received,
}: {
  received: Map<string, ActivityMessage[]>;
}) {
  const ctx = useRoomConnectionContext();
  if (ctx?.connectionState !== 'connected' || !ctx.roomState) return null;
  const game = ctx.roomState.game;
  return <Board key={game} game={game} received={received} />;
}

function Board({
  game,
  received,
}: {
  game: string;
  received: Map<string, ActivityMessage[]>;
}) {
  const ctx = useRoomConnectionContext();
  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((message) => {
      received.set(game, [...(received.get(game) ?? []), message]);
    });
  }, [ctx, game, received]);
  return null;
}

function roomState(game: string) {
  return {
    game,
    hostUserId: 'user-a',
    queueEnabled: false,
    matchInProgress: false,
    members: [{ userId: 'user-a', role: 'player' }],
  };
}

describe('RoomConnectionProvider message backlog', () => {
  async function renderRoom(roomId: string) {
    const room = fakeRoom();
    await freshUseColyseusRoom(room);
    const received = new Map<string, ActivityMessage[]>();
    render(
      <RoomConnectionProvider
        roomId={roomId}
        session={session}
        game="tic-tac-toe"
        queueEnabled={false}
        identity={identity}
      >
        <LateBoards received={received} />
      </RoomConnectionProvider>,
    );
    await waitFor(() => expect(room.onLeave).toHaveBeenCalled());
    return { room, received };
  }

  it('hands a board the messages that arrived before it mounted', async () => {
    const { room, received } = await renderRoom('ROOM10');

    act(() => {
      room.emit('room_state', roomState('tic-tac-toe'));
      room.emit('init', { player: 'X' });
    });

    await waitFor(() =>
      expect(received.get('tic-tac-toe')).toEqual([
        { type: 'init', payload: { player: 'X' } },
      ]),
    );
  });

  it('delivers each message once, even when the board resubscribes', async () => {
    const { room, received } = await renderRoom('ROOM11');
    act(() => {
      room.emit('room_state', roomState('tic-tac-toe'));
      room.emit('init', { player: 'X' });
    });
    await waitFor(() => expect(received.get('tic-tac-toe')).toHaveLength(1));

    act(() => {
      room.emit('room_state', {
        ...roomState('tic-tac-toe'),
        queueEnabled: true,
      });
      room.emit('state', { turn: 'O' });
    });

    await waitFor(() =>
      expect(received.get('tic-tac-toe')).toEqual([
        { type: 'init', payload: { player: 'X' } },
        { type: 'state', payload: { turn: 'O' } },
      ]),
    );
  });

  it("hands the new game's board its init after switch_game", async () => {
    const { room, received } = await renderRoom('ROOM12');
    act(() => {
      room.emit('room_state', roomState('tic-tac-toe'));
      room.emit('init', { player: 'X' });
    });
    await waitFor(() => expect(received.get('tic-tac-toe')).toHaveLength(1));

    act(() => {
      room.emit('room_state', roomState('connect-four'));
      room.emit('init', { disc: 'p1' });
    });

    await waitFor(() =>
      expect(received.get('connect-four')).toEqual([
        { type: 'init', payload: { disc: 'p1' } },
      ]),
    );
  });

  it('leaves a room whose join resolves after the provider unmounted', async () => {
    const room = fakeRoom();
    let resolveJoin: (value: typeof room) => void = () => {};
    mock.module('@colyseus/sdk', () => ({
      Client: class {
        joinOrCreate = () =>
          new Promise<typeof room>((resolve) => {
            resolveJoin = resolve;
          });
      },
    }));
    mock.module('../../lib/apiBase', () => ({
      apiBase: () => 'http://fake.test/api',
      apiUrl: (path: string) => `http://fake.test/api${path}`,
      colyseusUrl: () => 'ws://fake.test',
    }));

    const { unmount } = render(
      <RoomConnectionProvider
        roomId="ROOM13"
        session={session}
        game="tic-tac-toe"
        queueEnabled={false}
        identity={identity}
      >
        {null}
      </RoomConnectionProvider>,
    );
    unmount();
    await act(async () => resolveJoin(room));

    expect(room.leave).toHaveBeenCalled();
  });
});
