import { AudioPlayerStatus, joinVoiceChannel } from '@discordjs/voice';
import {
  CommandInteraction,
  GuildMember,
  Message,
  PermissionFlagsBits,
  PermissionResolvable,
  TextChannel,
  VoiceBasedChannel,
  VoiceChannel,
} from 'discord.js';
import { join } from 'path';

import { SafeAny } from '@marquinhos/types';
import BotError from '@utils/botError';
import BotAudioPlayer from '@utils/botAudioPlayer';

export const checkPermissions = (
  member: GuildMember,
  permissions: Array<PermissionResolvable>
) => {
  let neededPermissions: PermissionResolvable[] = [];
  permissions.forEach((permission) => {
    if (!member.permissions.has(permission)) neededPermissions.push(permission);
  });
  if (neededPermissions.length === 0) return null;
  return neededPermissions.map((p) => {
    if (typeof p === 'string') return p.split(/(?=[A-Z])/).join(' ');
    else
      return Object.keys(PermissionFlagsBits)
        .find((k) => Object(PermissionFlagsBits)[k] === p)
        ?.split(/(?=[A-Z])/)
        .join(' ');
  });
};

export const sendTimedMessage = (
  message: string,
  channel: TextChannel,
  duration: number
) => {
  channel
    .send(message)
    .then((m) =>
      setTimeout(
        async () => (await channel.messages.fetch(m)).delete(),
        duration
      )
    );
  return;
};

export const voiceChannelPresence = (message: SafeAny): VoiceChannel | null => {
  const channel = message.member?.voice.channel as VoiceChannel;
  if (!channel) {
    message.reply('Você precisa estar em um canal de voz!');
    throw new BotError('User not in voice channel', message, 'warn');
  }
  return channel;
};

export enum AudioPlayerDisconnectEvent {
  Disconnect = 'disconnect',
}

export const playAudio = (
  message: Message | CommandInteraction,
  channel: VoiceChannel | VoiceBasedChannel,
  filename: string
) => {
  if (!channel) {
    throw new BotError('Invalid channel', message, 'warn');
  }

  const audioPlayer = BotAudioPlayer.getInstance();

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
  });

  connection.subscribe(audioPlayer.player);
  audioPlayer.player.on(
    AudioPlayerDisconnectEvent.Disconnect as unknown as AudioPlayerStatus,
    () => {
      if (connection.state.status === 'destroyed') return;
      connection.destroy();
    }
  );
  audioPlayer.play(join(__dirname, `../resources/sounds/${filename}.mp3`));
};
