import { describe, expect, it } from 'bun:test';
import { WordleRaceSession } from 'services/activity/wordle-race/WordleRaceSession';
import { resolveCanonical } from 'services/wordle';

function targetWordOf(session: WordleRaceSession): string {
  return (
    session as unknown as {
      engine: { getState(): { targetWord: string } };
    }
  ).engine.getState().targetWord;
}

describe('WordleRaceSession target word', () => {
  it('is always a word the race accepts as a guess', () => {
    for (let i = 0; i < 200; i++) {
      const session = new WordleRaceSession(
        { sessionKey: 'k', instanceId: 'i', guildId: 'g', mode: 'multi' },
        { broadcast: () => {} },
        { recordGameResult: () => {} } as never,
      );
      const target = targetWordOf(session);
      expect({ target, canonical: resolveCanonical(target) }).toEqual({
        target,
        canonical: target,
      });
    }
  });
});
