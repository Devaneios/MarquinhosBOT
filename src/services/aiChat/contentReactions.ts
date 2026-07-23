import { GuildConfig } from '@marquinhos/config/guild';
import { classify, pickEmoji, pickQuirkyLine } from './lexicon';

const QUIRKY_ROLL_CHANCE = 0.003;

export interface ContentReactionMessage {
  content: string;
  channelId: string;
  react(emoji: string): Promise<unknown>;
  reply(content: string): Promise<unknown>;
}

export async function handleContentReaction(
  message: ContentReactionMessage,
  random: () => number = Math.random,
): Promise<void> {
  if (message.channelId !== GuildConfig.DEVANEIOS_CHANNEL_ID) return;

  const bucket = classify(message.content);

  if (bucket !== 'neutro') {
    await message.react(pickEmoji(bucket));
  }

  if (random() < QUIRKY_ROLL_CHANCE) {
    await message.reply(pickQuirkyLine(bucket));
  }
}
