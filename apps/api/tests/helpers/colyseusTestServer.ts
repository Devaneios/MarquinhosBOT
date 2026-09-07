import { ColyseusTestServer } from '@colyseus/testing';
import { matchMaker, Server } from 'colyseus';
import { randomInt } from 'node:crypto';

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
