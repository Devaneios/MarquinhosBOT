import { describe, expect, it, mock } from 'bun:test';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { TriviaQuizSession } from 'services/activity/trivia-quiz/TriviaQuizSession';

describe('TriviaQuizSession', () => {
  function createMockBroadcaster(): ActivityBroadcaster {
    return {
      broadcast: mock(() => {}),
    };
  }

  it('allows up to 8 players to join', () => {
    const broadcaster = createMockBroadcaster();
    const session = new TriviaQuizSession(
      {
        sessionKey: 'key1',
        instanceId: 'inst1',
        guildId: 'guild1',
        mode: 'multi',
      },
      broadcaster,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      undefined as any,
    );

    for (let i = 0; i < 8; i++) {
      const result = session.addPlayer(`user${i}`, {});
      expect(result).toBe(true);
    }
  });

  it('rejects adding a 9th player', () => {
    const broadcaster = createMockBroadcaster();
    const session = new TriviaQuizSession(
      {
        sessionKey: 'key1',
        instanceId: 'inst1',
        guildId: 'guild1',
        mode: 'multi',
      },
      broadcaster,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      undefined as any,
    );

    for (let i = 0; i < 8; i++) {
      session.addPlayer(`user${i}`, {});
    }
    const result = session.addPlayer('user9', {});
    expect(result).toBe(false);
  });

  it('tracks player state correctly', () => {
    const broadcaster = createMockBroadcaster();
    const session = new TriviaQuizSession(
      {
        sessionKey: 'key1',
        instanceId: 'inst1',
        guildId: 'guild1',
        mode: 'multi',
      },
      broadcaster,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      undefined as any,
    );

    const result = session.addPlayer('user1', {});
    expect(result).toBe(true);
    const state = session.getState();
    expect(state.players.size).toBe(1);
  });
});
