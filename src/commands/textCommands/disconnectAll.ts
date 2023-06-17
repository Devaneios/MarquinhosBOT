import { Message } from 'discord.js';
import { Command } from '../../types';

export const disconnectAll: Command = {
  name: 'encerrar-chamada',
  execute: async (message: Message, args: string[]) => {
    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
      message.channel.send('Mas tu nem tá num canal de voz vei :(');
      return;
    }

    const activeUsers = voiceChannel.members.values();
    for (const user of activeUsers) {
      await user.voice.setChannel(null);
    }
  },
  cooldown: 10,
  aliases: [],
  permissions: ['Administrator'],
};
