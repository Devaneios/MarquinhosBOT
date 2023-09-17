import { Message, VoiceChannel } from 'discord.js';

import { Command } from 'src/types';
import { playAudio } from 'src/utils/discord';

export const time: Command = {
  name: 'horario',
  execute: (message: Message, args: string[]) => {
    const currentHour = getParsedTime(true);
    const voiceChannel = message.member?.voice.channel as VoiceChannel;
    // If its midnight, Marquinhos enter the voice channel and ANNOUNCES that it's OLEO DE MACACO TIME
    if (currentHour == '00') {
      playAudio(message, voiceChannel, '_macaco');
    } else {
      // If its not midnight, Marquinhos send the time in the channel
      const currentTime = getParsedTime(false);
      message.channel.send(`Agora são ${currentTime}`);
    }
  },
  cooldown: 10,
  aliases: [],
  permissions: [],
};

const getParsedTime = (onlyHour: boolean) => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: onlyHour ? undefined : '2-digit',
    hour12: false,
    timeZone: 'America/Recife',
  };
  return now.toLocaleString('pt-BR', options);
};
