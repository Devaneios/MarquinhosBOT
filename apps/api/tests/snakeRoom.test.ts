import { describe, expect, it } from 'bun:test';
import { SnakeRoom } from 'realtime/SnakeRoom';

describe('SnakeRoom', () => {
  it('initializes room properly', () => {
    const room = new SnakeRoom();
    expect(room).toBeDefined();
  });

  it('rejects auth without valid token', async () => {
    const room = new SnakeRoom();

    try {
      await room.onAuth({} as any, { roomKey: 'test', token: undefined });
      expect(false).toBe(true);
    } catch (e) {
      expect(String(e)).toContain('Invalid');
    }
  });
});
