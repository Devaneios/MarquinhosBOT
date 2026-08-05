import { describe, expect, it, mock } from 'bun:test';

function fakeRoom() {
  const messageHandlers: Record<string, (type: unknown, payload: unknown) => void> = {};
  return {
    onMessage: mock((type: string, cb: (type: unknown, payload: unknown) => void) => {
      messageHandlers[type] = cb;
      return () => delete messageHandlers[type];
    }),
    send: mock((_type: string, _payload?: unknown) => {}),
    leave: mock(async (_consented?: boolean) => 0),
    emit(type: string, payload: unknown) {
      messageHandlers['*']?.(type, payload);
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
