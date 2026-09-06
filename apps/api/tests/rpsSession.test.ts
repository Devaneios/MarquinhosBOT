import { describe, expect, it } from 'bun:test';
import { RpsSession } from 'services/activity/rps/RpsSession';

function noopBroadcaster() {
  return { broadcast: () => {} };
}

describe('RpsSession.getWinnerUserId', () => {
  it('returns null before a match concludes', () => {
    const session = new RpsSession(
      { sessionKey: 'k', instanceId: 'i', guildId: 'g', mode: 'multi' },
      noopBroadcaster(),
    );
    session.addPlayer('user-a', {});
    session.addPlayer('user-b', {});
    expect(session.getWinnerUserId()).toBe(null);
  });

  it('resolves to the winning userId once the match ends (default bestOf 1)', () => {
    const session = new RpsSession(
      { sessionKey: 'k', instanceId: 'i', guildId: 'g', mode: 'multi' },
      noopBroadcaster(),
      undefined,
      { bestOf: 1 },
    );
    session.addPlayer('user-a', {});
    session.addPlayer('user-b', {});
    session.submitPick('user-a', 'rock');
    session.submitPick('user-b', 'scissors');
    expect(session.getWinnerUserId()).toBe('user-a');
  });
});

describe('RpsSession.substitutePlayer', () => {
  it('reseats the incoming player and resets the round for a fresh match', () => {
    const session = new RpsSession(
      { sessionKey: 'k', instanceId: 'i', guildId: 'g', mode: 'multi' },
      noopBroadcaster(),
      undefined,
      { bestOf: 1 },
    );
    session.addPlayer('user-a', {});
    session.addPlayer('user-b', {});
    session.submitPick('user-a', 'rock');
    session.submitPick('user-b', 'scissors'); // user-a wins, match ends

    const ok = session.substitutePlayer('user-b', 'user-c', {});
    expect(ok).toBe(true);
    expect(session.getWinnerUserId()).toBe(null); // round reset, no winner yet

    session.submitPick('user-a', 'rock');
    const accepted = session.submitPick('user-c', 'scissors');
    expect(accepted).toBe(true);
    expect(session.getWinnerUserId()).toBe('user-a');
  });
});
