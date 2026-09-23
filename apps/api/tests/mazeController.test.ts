import { describe, expect, it } from 'bun:test';
import { MazeController } from 'controllers/maze.controller';

function makeReq(body: unknown, params: Record<string, string> = {}) {
  return { body, params } as any;
}

function makeRes() {
  let statusCode: number | undefined;
  let payload: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: unknown) {
      payload = data;
      return res;
    },
    getStatus: () => statusCode,
    getPayload: () => payload,
  };
  return res;
}

describe('MazeController input validation', () => {
  const controller = new MazeController();

  it('rejects a start request without userId or guildId', () => {
    const res = makeRes();
    controller.startMaze(
      makeReq({ userId: 'u1', mode: 'open', size: 15 }),
      res as any,
    );
    expect(res.getStatus()).toBe(400);
    expect(res.getPayload()).toEqual({
      message: 'userId and guildId are required',
    });
  });

  it('rejects an unknown mode', () => {
    const res = makeRes();
    controller.startMaze(
      makeReq({ userId: 'u1', guildId: 'g1', mode: 'dark', size: 15 }),
      res as any,
    );
    expect(res.getStatus()).toBe(400);
    expect(res.getPayload()).toEqual({
      message: 'mode must be one of: open, foggy',
    });
  });

  it('rejects an unsupported size', () => {
    const res = makeRes();
    controller.startMaze(
      makeReq({ userId: 'u1', guildId: 'g1', mode: 'open', size: 16 }),
      res as any,
    );
    expect(res.getStatus()).toBe(400);
    expect(res.getPayload()).toEqual({
      message: 'size must be one of: 15, 31, 51, 99',
    });
  });

  it('rejects a move without userId or with an unknown direction', () => {
    const missingUser = makeRes();
    controller.moveMaze(
      makeReq({ direction: 'up' }, { sessionId: 's1' }),
      missingUser as any,
    );
    expect(missingUser.getPayload()).toEqual({
      message: 'userId is required',
    });

    const badDirection = makeRes();
    controller.moveMaze(
      makeReq({ userId: 'u1', direction: 'north' }, { sessionId: 's1' }),
      badDirection as any,
    );
    expect(badDirection.getStatus()).toBe(400);
    expect(badDirection.getPayload()).toEqual({
      message: 'direction must be one of: up, down, left, right',
    });
  });

  it('rejects an abandon request without userId', () => {
    const res = makeRes();
    controller.abandonMaze(makeReq(null, { sessionId: 's1' }), res as any);
    expect(res.getStatus()).toBe(400);
    expect(res.getPayload()).toEqual({ message: 'userId is required' });
  });
});
