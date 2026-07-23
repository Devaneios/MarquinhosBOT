import { describe, expect, it } from 'bun:test';
import { GuildConfig } from '@marquinhos/config/guild';
import { handleContentReaction } from '@marquinhos/services/aiChat/contentReactions';

function makeMessage(content: string, channelId: string = GuildConfig.DEVANEIOS_CHANNEL_ID) {
  const reactions: string[] = [];
  const replies: string[] = [];
  return {
    content,
    channelId,
    react: async (emoji: string) => {
      reactions.push(emoji);
    },
    reply: async (text: string) => {
      replies.push(text);
    },
    reactions,
    replies,
  };
}

describe('handleContentReaction', () => {
  it('reacts when the content is not neutral', async () => {
    const message = makeMessage('que jogo incrível, adorei');
    await handleContentReaction(message, () => 1);
    expect(message.reactions.length).toBe(1);
  });

  it('does not react to neutral content', async () => {
    const message = makeMessage('vou sair pra comprar pão');
    await handleContentReaction(message, () => 1);
    expect(message.reactions.length).toBe(0);
  });

  it('sends a quirky reply when the random roll is below the threshold', async () => {
    const message = makeMessage('vou sair pra comprar pão');
    await handleContentReaction(message, () => 0);
    expect(message.replies.length).toBe(1);
  });

  it('does not send a quirky reply when the random roll is above the threshold', async () => {
    const message = makeMessage('vou sair pra comprar pão');
    await handleContentReaction(message, () => 0.5);
    expect(message.replies.length).toBe(0);
  });

  it('does not react or reply for messages outside the Devaneios channel', async () => {
    const message = makeMessage('que jogo incrível, adorei', 'some-other-channel');
    await handleContentReaction(message, () => 0);
    expect(message.reactions.length).toBe(0);
    expect(message.replies.length).toBe(0);
  });
});
