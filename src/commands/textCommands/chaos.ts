import { Message } from 'discord.js';
import { Command } from '../../types';
import { coerceNumberProperty } from '../../utils/coercion';

export const chaos: Command = {
  name: 'chaos',
  execute: (message: Message, args: string[]) => {
    const levelOfChaos = coerceNumberProperty(args[1], 10);
    if (levelOfChaos > 25) {
      message.channel.send('Não posso fazer isso, o caos é muito grande!');
      return;
    }

    const currentVoiceChannel = message.member?.voice.channel;
    if (!currentVoiceChannel) {
      message.channel.send('Você precisa estar em um canal de voz!');
      return;
    }

    const voiceChannelMembersArray = Array.from(
      currentVoiceChannel.members.values()
    );
  },
  cooldown: 10,
  aliases: [],
  permissions: [],
};
