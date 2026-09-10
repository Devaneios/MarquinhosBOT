import { describe, expect, it } from 'bun:test';
import { activityEndpoints } from './activityEndpoints';

describe('Activity endpoints', () => {
  it('keeps Discord traffic behind its proxy in both environments', () => {
    for (const development of [true, false]) {
      expect(
        activityEndpoints(
          'https://123.discordsays.com',
          development,
          'https://api.example.com',
        ),
      ).toEqual({
        api: '/.proxy/api',
        colyseus: 'wss://123.discordsays.com/.proxy/colyseus',
      });
    }
  });

  it('uses plain WebSockets for localhost and preserves the configured production API', () => {
    expect(activityEndpoints('http://localhost:5173', true)).toEqual({
      api: 'http://localhost:5173/api',
      colyseus: 'ws://localhost:5173/colyseus',
    });
    expect(
      activityEndpoints(
        'https://activity.example.com',
        false,
        'https://api.example.com',
      ),
    ).toEqual({
      api: 'https://api.example.com/api',
      colyseus: 'wss://api.example.com',
    });
  });

  it('uses the frontend gateway in development even with a stale API origin', () => {
    expect(
      activityEndpoints(
        'https://local.example.com',
        true,
        'http://localhost:3000',
      ),
    ).toEqual({
      api: 'https://local.example.com/api',
      colyseus: 'wss://local.example.com/colyseus',
    });
  });
});
