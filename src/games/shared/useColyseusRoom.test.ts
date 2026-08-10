import { describe, expect, it, mock } from 'bun:test';

function fakeRoom() {
  const messageHandlers: Record<string, (type: unknown, payload: unknown) => void> = {};
  const dropHandlers: Array<(code: number, reason?: string) => void> = [];
  const reconnectHandlers: Array<() => void> = [];
  const leaveHandlers: Array<(code: number, reason?: string) => void> = [];
  const errorHandlers: Array<(code: number, message?: string) => void> = [];
  return {
    roomId: 'room-1',
    onMessage: mock((type: string, cb: (type: unknown, payload: unknown) => void) => {
      messageHandlers[type] = cb;
      return () => delete messageHandlers[type];
    }),
    onDrop: mock((cb: (code: number, reason?: string) => void) => {
      dropHandlers.push(cb);
    }),
    onReconnect: mock((cb: () => void) => {
      reconnectHandlers.push(cb);
    }),
    onLeave: mock((cb: (code: number, reason?: string) => void) => {
      leaveHandlers.push(cb);
    }),
    onError: mock((cb: (code: number, message?: string) => void) => {
      errorHandlers.push(cb);
    }),
    send: mock((_type: string, _payload?: unknown) => {}),
    leave: mock(async (_consented?: boolean) => 0),
    emit(type: string, payload: unknown) {
      messageHandlers['*']?.(type, payload);
    },
    emitDrop(code = 1006, reason?: string) {
      dropHandlers.forEach((h) => h(code, reason));
    },
    emitReconnect() {
      reconnectHandlers.forEach((h) => h());
    },
    emitLeave(code = 1000, reason?: string) {
      leaveHandlers.forEach((h) => h(code, reason));
    },
    emitError(code = 4000, message?: string) {
      errorHandlers.forEach((h) => h(code, message));
    },
  };
}

async function freshModule(client: {
  joinOrCreate: (game: string, options: unknown) => Promise<unknown>;
}) {
  mock.module('@colyseus/sdk', () => ({
    Client: class {
      endpoint: string;
      constructor(endpoint: string) {
        this.endpoint = endpoint;
      }
      joinOrCreate(game: string, options: unknown) {
        return client.joinOrCreate(game, options);
      }
    },
  }));
  return import(`./useColyseusRoom.ts?${Math.random()}`);
}

describe('connectToRoom', () => {
  it('joins the given game with the session token and roomKey', async () => {
    const room = fakeRoom();
    const joinOrCreate = mock(async (_game: string, _options: unknown) => room);
    const mod = await freshModule({ joinOrCreate });

    await mod.connectToRoom(
      'wordle',
      { token: 'tok-1', roomKey: 'inst-1:wordle:single:user-1' },
      'ws://fake.test',
      () => {},
    );

    expect(joinOrCreate).toHaveBeenCalledWith('wordle', {
      token: 'tok-1',
      roomKey: 'inst-1:wordle:single:user-1',
    });
  });

  it('forwards every room message to the onMessage callback', async () => {
    const room = fakeRoom();
    const mod = await freshModule({
      joinOrCreate: async () => room,
    });
    const received: unknown[] = [];

    await mod.connectToRoom(
      'wordle',
      { token: 't', roomKey: 'k' },
      'ws://fake.test',
      (message: unknown) => received.push(message),
    );
    room.emit('guess_result', { attempts: 1 });

    expect(received).toEqual([{ type: 'guess_result', payload: { attempts: 1 } }]);
  });

  it('propagates a rejected join (e.g. invalid token) to the caller', async () => {
    const failure = new Error('rejected');
    const mod = await freshModule({
      joinOrCreate: async () => {
        throw failure;
      },
    });

    await expect(
      mod.connectToRoom(
        'wordle',
        { token: 'bad', roomKey: 'k' },
        'ws://fake.test',
        () => {},
      ),
    ).rejects.toBe(failure);
  });
});

describe('wireRoomLifecycle', () => {
  it('moves to connected on a successful automatic reconnect', async () => {
    const room = fakeRoom();
    const mod = await freshModule({ joinOrCreate: async () => room });
    const states: string[] = [];

    mod.wireRoomLifecycle(room, 'wordle', (state: string) => states.push(state));
    room.emitReconnect();

    expect(states).toEqual(['connected']);
  });

  it('moves to disconnected on a terminal onLeave', async () => {
    const room = fakeRoom();
    const mod = await freshModule({ joinOrCreate: async () => room });
    const states: string[] = [];

    mod.wireRoomLifecycle(room, 'wordle', (state: string) => states.push(state));
    room.emitLeave(1000, 'normal close');

    expect(states).toEqual(['disconnected']);
  });

  it('does not change state on a transient drop (SDK is retrying)', async () => {
    const room = fakeRoom();
    const mod = await freshModule({ joinOrCreate: async () => room });
    const states: string[] = [];

    mod.wireRoomLifecycle(room, 'wordle', (state: string) => states.push(state));
    room.emitDrop(1006);

    expect(states).toEqual([]);
  });

  it('does not change state on a transport error (precedes close, would race the SDK reconnect decision)', async () => {
    const room = fakeRoom();
    const mod = await freshModule({ joinOrCreate: async () => room });
    const states: string[] = [];

    mod.wireRoomLifecycle(room, 'wordle', (state: string) => states.push(state));
    room.emitError(4000, 'boom');

    expect(states).toEqual([]);
  });
});
