import { describe, expect, it } from 'bun:test';
import { roomKey } from 'services/activity/roomKey';

describe('roomKey', () => {
  it('scopes multi-mode sessions to instance and game, shared across users', () => {
    expect(
      roomKey({
        instanceId: 'inst-1',
        game: 'pong',
        mode: 'multi',
        userId: 'user-1',
        roomId: 'ABC123',
      }),
    ).toBe('inst-1:ABC123:pong:multi');
    expect(
      roomKey({
        instanceId: 'inst-1',
        game: 'pong',
        mode: 'multi',
        userId: 'user-2',
        roomId: 'ABC123',
      }),
    ).toBe('inst-1:ABC123:pong:multi');
  });

  it('scopes single/local mode sessions per user', () => {
    expect(
      roomKey({
        instanceId: 'inst-1',
        game: 'pong',
        mode: 'single',
        userId: 'user-1',
      }),
    ).toBe('inst-1:pong:single:user-1');
    expect(
      roomKey({
        instanceId: 'inst-1',
        game: 'pong',
        mode: 'local',
        userId: 'user-1',
      }),
    ).toBe('inst-1:pong:local:user-1');
  });

  it('scopes by game so one instance can host more than one game', () => {
    expect(
      roomKey({
        instanceId: 'inst-1',
        game: 'wordle',
        mode: 'single',
        userId: 'user-1',
      }),
    ).toBe('inst-1:wordle:single:user-1');
  });

  it('is unaffected by an absent ruleset (Pong/Wordle callers unchanged)', () => {
    expect(
      roomKey({
        instanceId: 'inst-1',
        game: 'pong',
        mode: 'multi',
        userId: 'user-1',
        roomId: 'ABC123',
      }),
    ).toBe('inst-1:ABC123:pong:multi');
  });

  it('appends the ruleset to a multi-mode key so two different card games in the same instance never collide', () => {
    expect(
      roomKey({
        instanceId: 'inst-1',
        game: 'cards',
        mode: 'multi',
        userId: 'user-1',
        roomId: 'ABC123',
        ruleset: 'truco',
      }),
    ).toBe('inst-1:ABC123:cards:multi:truco');
  });

  it('appends the ruleset to a private-mode key after the userId', () => {
    expect(
      roomKey({
        instanceId: 'inst-1',
        game: 'cards',
        mode: 'single',
        userId: 'user-1',
        ruleset: 'truco',
      }),
    ).toBe('inst-1:cards:single:user-1:truco');
  });

  it('requires a roomId for multi-mode sessions and scopes the key to it', () => {
    expect(
      roomKey({
        instanceId: 'inst-1',
        game: 'pong',
        mode: 'multi',
        userId: 'user-1',
        roomId: 'ABC123',
      }),
    ).toBe('inst-1:ABC123:pong:multi');
  });

  it('throws when mode is multi and roomId is missing', () => {
    expect(() =>
      roomKey({
        instanceId: 'inst-1',
        game: 'pong',
        mode: 'multi',
        userId: 'user-1',
      }),
    ).toThrow();
  });

  it('appends the ruleset after the roomId-scoped multi-mode base', () => {
    expect(
      roomKey({
        instanceId: 'inst-1',
        game: 'cards',
        mode: 'multi',
        userId: 'user-1',
        roomId: 'ABC123',
        ruleset: 'truco',
      }),
    ).toBe('inst-1:ABC123:cards:multi:truco');
  });
});
