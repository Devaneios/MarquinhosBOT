import { Message, TextChannel } from 'discord.js';

import { BotEvent } from '@marquinhos/types';
import { handlePotentialSpam } from '../moderation/spam';

export const messageCreate: BotEvent = {
  name: 'messageCreate',
  execute: async (message: Message) => {
    if (message.channel instanceof TextChannel && message.author.bot) {
      return;
    }
    if (!message.member) return;
    if (!message.guild) return;

    const messageContent = message.content.trim();
    if (!messageContent) return;

    handlePotentialSpam(message);
  },
};
