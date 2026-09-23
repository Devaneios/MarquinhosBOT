import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { startContractServer } from '../helpers/contractServer';

const { callContract } = await import('@marquinhos/api-client/bot');
const maze = await import('@marquinhos/contracts/http/routes/maze');

let server: Awaited<ReturnType<typeof startContractServer>>;

beforeAll(async () => {
  const { default: mazeRouter } = await import('../../src/routes/maze.route');
  server = await startContractServer((app) => {
    app.use('/api/games/maze', mazeRouter);
  });
});

afterAll(() => server.close());

describe('maze contracts', () => {
  it('starts, moves, reads and abandons a maze session', async () => {
    const guildId = `contract-${randomUUID()}`;
    const started = await callContract(server.http, maze.startMaze, {
      body: { userId: 'u1', guildId, mode: 'open', size: 15 },
    });
    const sessionId = started.data.sessionId;
    const moved = await callContract(server.http, maze.moveMaze, {
      params: { sessionId },
      body: { userId: 'u1', direction: 'down' },
    });
    const read = await callContract(server.http, maze.getMaze, {
      params: { sessionId },
    });
    const abandoned = await callContract(server.http, maze.abandonMaze, {
      params: { sessionId },
      body: { userId: 'u1' },
    });

    expect(started.data.moves).toBe(0);
    expect(started.data.viewport).toHaveLength(8);
    expect(moved.data.sessionId).toBe(sessionId);
    expect(read.data.moves).toBe(moved.data.moves);
    expect(abandoned.message).toBe('Maze session abandoned');
  });
});
