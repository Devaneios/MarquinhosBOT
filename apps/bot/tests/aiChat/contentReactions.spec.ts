import { GuildConfig } from '@marquinhos/config/guild';
import { handleContentReaction } from '@marquinhos/services/aiChat/contentReactions';
import type { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { describe, expect, it } from 'bun:test';

function makeMessage(
  content: string,
  channelId: string = GuildConfig.DEVANEIOS_CHANNEL_ID,
) {
  const reactions: string[] = [];
  return {
    content,
    channelId,
    react: async (emoji: string) => {
      reactions.push(emoji);
    },
    reactions,
  };
}

function makeApiService(emojis: string[]) {
  return {
    chooseEmojiReactions: async () => ({ data: { emojis } }),
  } as unknown as Pick<MarquinhosApiService, 'chooseEmojiReactions'>;
}

describe('handleContentReaction', () => {
  it('reacts with each emoji returned by the API', async () => {
    const message = makeMessage('kkkkk mano que hilário');
    await handleContentReaction(
      message,
      makeApiService(['😂', 'cavaloemoji:725868757779742787']),
    );
    expect(message.reactions).toEqual(['😂', 'cavaloemoji:725868757779742787']);
  });

  it('does not call the API or react for messages outside the Devaneios channel', async () => {
    let called = false;
    const message = makeMessage('kkkkk', 'some-other-channel');
    const apiService = {
      chooseEmojiReactions: async () => {
        called = true;
        return { data: { emojis: ['😂'] } };
      },
    } as unknown as Pick<MarquinhosApiService, 'chooseEmojiReactions'>;

    await handleContentReaction(message, apiService);

    expect(called).toBe(false);
    expect(message.reactions.length).toBe(0);
  });

  it('fails soft (does not throw, does not react) when the API call rejects', async () => {
    const message = makeMessage('kkkkk');
    const apiService = {
      chooseEmojiReactions: async () => {
        throw new Error('network down');
      },
    } as unknown as Pick<MarquinhosApiService, 'chooseEmojiReactions'>;

    await expect(
      handleContentReaction(message, apiService),
    ).resolves.toBeUndefined();
    expect(message.reactions.length).toBe(0);
  });

  it('continues reacting with remaining emojis if one react() call fails', async () => {
    const reactions: string[] = [];
    const message = {
      content: 'kkkkk',
      channelId: GuildConfig.DEVANEIOS_CHANNEL_ID,
      react: async (emoji: string) => {
        if (emoji === 'bad:1') throw new Error('unknown emoji');
        reactions.push(emoji);
      },
    };

    await handleContentReaction(message, makeApiService(['bad:1', '😂']));

    expect(reactions).toEqual(['😂']);
  });
});
