import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { startNestContractServer } from './helpers/contractServer';

let server: Awaited<ReturnType<typeof startNestContractServer>>;

beforeAll(async () => {
  const { MazeModule } = await import('modules/maze/maze.module');
  server = await startNestContractServer({ imports: [MazeModule] });
});

afterAll(() => server.close());

async function request(method: string, path: string, body?: unknown) {
  const response = await fetch(`${server.origin}${path}`, {
    method,
    headers: {
      authorization: 'Bearer contract-test-key',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

describe('MazeController input validation', () => {
  it('rejects a start request without userId or guildId', async () => {
    const response = await request('POST', '/api/games/maze/start', {
      userId: 'u1',
      mode: 'open',
      size: 15,
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: 'userId and guildId are required',
    });
  });

  it('rejects an unknown mode', async () => {
    const response = await request('POST', '/api/games/maze/start', {
      userId: 'u1',
      guildId: 'g1',
      mode: 'dark',
      size: 15,
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: 'mode must be one of: open, foggy',
    });
  });

  it('rejects an unsupported size', async () => {
    const response = await request('POST', '/api/games/maze/start', {
      userId: 'u1',
      guildId: 'g1',
      mode: 'open',
      size: 16,
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: 'size must be one of: 15, 31, 51, 99',
    });
  });

  it('rejects a move without userId or with an unknown direction', async () => {
    const missingUser = await request('POST', '/api/games/maze/s1/move', {
      direction: 'up',
    });
    expect(missingUser.status).toBe(400);
    expect(missingUser.body).toEqual({ message: 'userId is required' });

    const badDirection = await request('POST', '/api/games/maze/s1/move', {
      userId: 'u1',
      direction: 'north',
    });
    expect(badDirection.status).toBe(400);
    expect(badDirection.body).toEqual({
      message: 'direction must be one of: up, down, left, right',
    });
  });

  it('rejects an abandon request without userId', async () => {
    const response = await request('DELETE', '/api/games/maze/s1', {});
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'userId is required' });
  });
});
