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

describe('TriviaQuizSession start', () => {
  function createSession() {
    const broadcast = mock(() => {});
    const session = new TriviaQuizSession(
      {
        sessionKey: 'key1',
        instanceId: 'inst1',
        guildId: 'guild1',
        mode: 'multi',
      },
      { broadcast },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { recordGameResult: () => {} } as any,
    );
    return { session, broadcast };
  }

  it('has no public question before the game starts', () => {
    const { session } = createSession();
    session.addPlayer('user1', {});
    session.addPlayer('user2', {});

    expect(session.getPublicState()).toBeNull();
    session.dispose();
  });

  it('ignores a second start so a rejoining player cannot reset the quiz', () => {
    const { session } = createSession();
    session.addPlayer('user1', {});
    session.addPlayer('user2', {});
    session.start();
    session.handleAnswer('user1', 0, Date.now());

    session.start();

    expect(session.getPublicState()?.currentQuestionIndex).toBe(0);
    expect(session.getState().playerAnswers.has('user1')).toBe(true);
    session.dispose();
  });
});
