import { Message, TextChannel } from 'discord.js';
import { Command } from '../../types';
import { coerceNumberProperty } from '../../utils/coercion';

export const clone: Command = {
  name: 'clone',
  execute: async (message: Message, args: string[]) => {
    const incommingChannel = message.channel as TextChannel;

    if (args.length < 2) {
      return await incommingChannel.send('Você precisa inserir uma mensagem!');
    }

    const parsedMessage = args.slice(1).join(' ');

    await incommingChannel.send(`${parsedMessage}`);
    await message.delete();
  },
  cooldown: 10,
  aliases: [],
  permissions: ['Administrator'],
};
