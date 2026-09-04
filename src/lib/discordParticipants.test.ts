import { describe, expect, it, mock } from 'bun:test';

async function freshModule(
  getParticipants: () => Promise<{
    participants: Array<{ id: string; nickname?: string; global_name?: string | null; username: string }>;
  }>,
) {
  mock.module('../discordSdk', () => ({
    discordSdk: {
      commands: {
        getActivityInstanceConnectedParticipants: getParticipants,
      },
    },
  }));
  const mod = await import(`./discordParticipants.ts?${Math.random()}`);
  return mod.getParticipantDisplayNames as () => Promise<Record<string, string>>;
}

describe('getParticipantDisplayNames', () => {
  it('maps userId to the best available display name (nickname > global_name > username)', async () => {
    const getParticipantDisplayNames = await freshModule(async () => ({
      participants: [
        { id: 'u1', nickname: 'Nick', global_name: 'Global', username: 'user1' },
        { id: 'u2', global_name: 'Global2', username: 'user2' },
        { id: 'u3', username: 'user3' },
      ],
    }));

    const result = await getParticipantDisplayNames();

    expect(result).toEqual({ u1: 'Nick', u2: 'Global2', u3: 'user3' });
  });

  it('returns an empty map if the SDK call fails, rather than throwing', async () => {
    const getParticipantDisplayNames = await freshModule(async () => {
      throw new Error('not connected');
    });

    const result = await getParticipantDisplayNames();

    expect(result).toEqual({});
  });
});
