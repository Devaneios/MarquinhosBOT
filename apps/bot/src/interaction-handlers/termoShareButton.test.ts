import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { expect, it, mock, spyOn } from 'bun:test';
import { ChannelType } from 'discord.js';
import { TermoShareButtonHandler } from './termoShareButton';

it('does not publish another player’s preview', async () => {
  const send = mock(async () => {});
  const reply = mock(async () => {});
  const interaction = {
    guildId: 'g',
    guild: {
      channels: { fetch: async () => ({ type: ChannelType.GuildText, send }) },
    },
    user: { id: 'other' },
    reply,
    message: { id: 'message' },
  };
  await TermoShareButtonHandler.prototype.run.call({}, interaction as never, {
    userId: 'owner',
    channelId: 'channel',
    achievementId: 'one',
  });
  expect(send).not.toHaveBeenCalled();
  expect(reply).toHaveBeenCalledTimes(1);
});

it('does not publish where the player lacks channel permission', async () => {
  const send = mock(async () => {});
  const editReply = mock(async () => {});
  const interaction = {
    guildId: 'g',
    guild: {
      channels: {
        fetch: async () => ({
          type: ChannelType.GuildText,
          permissionsFor: () => ({ has: () => false }),
          send,
        }),
      },
    },
    user: { id: 'owner' },
    message: { id: 'message' },
    deferUpdate: async () => {},
    editReply,
  };
  await TermoShareButtonHandler.prototype.run.call({}, interaction as never, {
    userId: 'owner',
    channelId: 'channel',
    achievementId: 'one',
  });
  expect(send).not.toHaveBeenCalled();
  expect(editReply).toHaveBeenCalledTimes(2);
});

it('publishes the unlocked achievement only after confirmation', async () => {
  const spy = spyOn(
    MarquinhosApiService.prototype,
    'getWordleAchievements',
  ).mockResolvedValue({
    data: {
      achievements: [
        {
          id: 'one',
          name: 'Primeira',
          description: 'Uma conquista',
          icon: '🏆',
          rarity: 'common',
          rewardXp: 0,
          family: 'wins',
          tier: 1,
          hidden: false,
          unlockedAt: '2026-10-01T12:00:00.000Z',
          progress: null,
          holdersPercent: null,
        },
      ],
      stats: {
        played: 1,
        wins: 1,
        winRate: 100,
        currentStreak: 1,
        bestStreak: 1,
        distribution: [0, 1, 0, 0, 0, 0, 0, 0],
      },
    },
  } as never);
  const send = mock(async () => {});
  const channel = {
    id: 'channel',
    type: ChannelType.GuildText,
    permissionsFor: () => ({ has: () => true }),
    send,
  };
  const interaction = {
    guildId: 'g',
    guild: {
      channels: { fetch: async () => channel },
      members: {
        fetch: async () => ({
          displayName: 'Ana',
          displayAvatarURL: () => 'https://cdn/ana.png',
        }),
      },
    },
    client: { user: null },
    user: {
      id: 'owner',
      displayName: 'Ana',
      displayAvatarURL: () => 'https://cdn/ana.png',
    },
    message: { id: 'message-success' },
    deferUpdate: async () => {},
    editReply: async () => {},
  };
  await TermoShareButtonHandler.prototype.run.call({}, interaction as never, {
    userId: 'owner',
    channelId: 'channel',
    achievementId: 'one',
  });
  expect(send).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledTimes(2);
  spy.mockRestore();
});
