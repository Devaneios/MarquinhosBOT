import { Room as ClientRoom } from '@colyseus/sdk';
import { ColyseusTestServer } from '@colyseus/testing';
import { matchMaker, Server } from 'colyseus';
import { randomInt } from 'node:crypto';

interface Inbox {
  log: { type: string; message: unknown }[];
  received: { type: string; message: unknown }[];
  waiters: {
    type: string;
    matches: (message: unknown) => boolean;
    resolve: (message: unknown) => void;
  }[];
}

const inboxes = new WeakMap<object, Inbox>();

function inboxOf(room: object): Inbox {
  let inbox = inboxes.get(room);
  if (!inbox) {
    inbox = { log: [], received: [], waiters: [] };
    inboxes.set(room, inbox);
  }
  return inbox;
}

const clientRoomPrototype = ClientRoom.prototype as unknown as {
  dispatchMessage: (type: string | number, message: unknown) => void;
};
const originalDispatch = clientRoomPrototype.dispatchMessage;
clientRoomPrototype.dispatchMessage = function (
  this: object,
  type: string | number,
  message: unknown,
) {
  const inbox = inboxOf(this);
  inbox.log.push({ type: String(type), message });
  const waiter = inbox.waiters.findIndex(
    (w) => w.type === String(type) && w.matches(message),
  );
  if (waiter >= 0) inbox.waiters.splice(waiter, 1)[0]!.resolve(message);
  else inbox.received.push({ type: String(type), message });
  originalDispatch.call(this, type, message);
};

// Colyseus flushes messages sent during onJoin right after the join
// confirmation, so a listener attached after connectTo() resolves can miss
// them. Every client room records what it receives from construction on;
// this returns the earliest unconsumed message of a type (optionally one
// that matches), or waits for one.
export function nextMessage<T = unknown>(
  client: object,
  type: string,
  matches: (message: T) => boolean = () => true,
  timeoutMs = 3_000,
): Promise<T> {
  const inbox = inboxOf(client);
  const index = inbox.received.findIndex(
    (m) => m.type === type && matches(m.message as T),
  );
  if (index >= 0) {
    return Promise.resolve(inbox.received.splice(index, 1)[0]!.message as T);
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`No matching '${type}' within ${timeoutMs}ms`)),
      timeoutMs,
    );
    inbox.waiters.push({
      type,
      matches: (message) => matches(message as T),
      resolve: (message) => {
        clearTimeout(timer);
        resolve(message as T);
      },
    });
  });
}

export function drainMessages(client: object, type: string): void {
  const inbox = inboxOf(client);
  inbox.received = inbox.received.filter((m) => m.type !== type);
}

export function unparsedMessages(
  clients: object[],
  schema: { safeParse(value: unknown): { success: boolean } },
): string[] {
  return clients.flatMap((client) =>
    inboxOf(client)
      .log.filter(
        ({ type, message }) =>
          !schema.safeParse(
            message === undefined ? { type } : { type, payload: message },
          ).success,
      )
      .map(({ type }) => type),
  );
}

export function pendingMessages(client: object, type: string): unknown[] {
  return inboxOf(client)
    .received.filter((m) => m.type === type)
    .map((m) => m.message);
}

export async function waitUntil(
  condition: () => boolean,
  timeoutMs = 3_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('Condition never became true');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

export async function bootColyseusTestServer(
  configure: (server: Server) => void,
): Promise<ColyseusTestServer> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const server = new Server({ greet: false });
    configure(server);
    const port = randomInt(20_000, 60_000);
    try {
      await server.listen(port);
    } catch (error) {
      server.transport.shutdown();
      if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') continue;
      throw error;
    }

    const address = server.transport.server?.address();
    if (!address || typeof address === 'string') {
      await server.gracefullyShutdown(false);
      throw new Error('Colyseus test server did not expose a TCP address');
    }
    (server as unknown as { port: number }).port = address.port;
    const testServer = new ColyseusTestServer(server);
    const roomIds = new Set<string>();
    const testServerMethods = testServer as unknown as {
      createRoom: (
        roomName: string,
        clientOptions?: unknown,
      ) => Promise<unknown>;
      getRoomById: (roomId: string) => unknown;
      cleanup: () => Promise<void>;
      shutdown: () => Promise<void>;
    };
    testServerMethods.createRoom = async (roomName, clientOptions = {}) => {
      const listing = await matchMaker.createRoom(roomName, clientOptions);
      roomIds.add(listing.roomId);
      return matchMaker.getLocalRoomById(listing.roomId);
    };
    testServerMethods.getRoomById = (roomId) =>
      matchMaker.getLocalRoomById(roomId);
    testServerMethods.cleanup = async () => {
      await Promise.all(
        [...roomIds].map((roomId) =>
          matchMaker.getLocalRoomById(roomId)?.disconnect(),
        ),
      );
      roomIds.clear();
      await testServer.sdk.auth.signOut();
    };
    testServerMethods.shutdown = async () => {
      await testServerMethods.cleanup();
      server.transport.shutdown();
    };
    return testServer;
  }
  throw new Error('Could not allocate a Colyseus test port');
}
