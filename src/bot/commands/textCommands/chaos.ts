import {
  Collection,
  GuildBasedChannel,
  GuildMember,
  Message,
  VoiceBasedChannel,
  VoiceChannel,
} from 'discord.js';

import { Command } from 'src/types';
import { coerceNumberProperty } from 'src/utils/coercion';
import { playAudio } from 'src/utils/discord';

export const chaos: Command = {
  name: 'chaos',
  execute: (message: Message, args: string[]) => {
    // Gets the audioPlayer to execute the command only after the audio finishes
    // playing
    // const audioPlayer = BotAudioPlayer.getInstance();
    const levelOfChaos = coerceNumberProperty(args[1], 10);
    if (levelOfChaos > 25) {
      message.channel.send(
        'Não posso fazer isso, vocês não aguentariam tamanho caos!'
      );
      return;
    }

    const currentVoiceChannel = message.member?.voice.channel;
    if (!currentVoiceChannel) {
      message.channel.send('Você precisa estar em um canal de voz!');
      return;
    }

    // Plays the audio to start chaos
    playAudio(message, currentVoiceChannel, '_caos');

    //When the audio finishes playing, call the function
    //audioPlayer.player.on(AudioPlayerStatus.Idle, () => {
    chaos2(message, levelOfChaos);
    //});
  },
  cooldown: 10,
  aliases: [],
  permissions: [],
};

async function chaos2(message: Message, limit: number) {
  const voiceChannelEnumNumber = 2;
  // Delete the message to hide the chaos
  message.delete();
  // Gets the voice channel that will (primaly) suffer the chaos
  const voiceChannel = message.member?.voice.channel;
  // Gets the list of all voice channels in the guild
  const voiceChannels = message.guild?.channels.cache.filter(
    (channel) => channel.type === voiceChannelEnumNumber
  );
  // Gets the list of all users in the voiceChannel
  const activeUsers = voiceChannel?.members.filter((user) => !user.user.bot);
  // Finally, calls the function chaos3, that will move people around and create REAL chaos
  if (
    voiceChannel != undefined &&
    voiceChannels != undefined &&
    activeUsers != undefined
  ) {
    chaos3(0, voiceChannel, voiceChannels, activeUsers, limit);
  } else {
    message.channel.send('Desculpe, mas houve um erro na execução.');
    return;
  }
}

// Chaos part 3. Here, we assign a random valid user to a random valid channel.
async function chaos3(
  counter: number,
  voiceChannel: VoiceBasedChannel,
  voiceChannels: Collection<string, GuildBasedChannel>,
  activeUsers: Collection<string, GuildMember>,
  limit: number
) {
  // That's how I made it work. Recursively calling the function chaos with a counter that goes from 1 to "limit".
  if (counter <= limit) {
    setTimeout(function () {
      // First, increment the counter to the next call
      counter++;
      // Create variable usuario
      let usuario: GuildMember | undefined;
      // Here, goes the code to randomly switch channels

      // Gets a random user and a random voice channel
      const userRandomKey = activeUsers.randomKey();
      const randomVoiceChannel = voiceChannels.random();

      // Checks if its a valid user key and channel
      if (userRandomKey != undefined && randomVoiceChannel != undefined) {
        usuario = activeUsers.get(userRandomKey);
      }
      // Checks if it got the user instance
      if (usuario != undefined) {
        usuario.voice.setChannel(randomVoiceChannel as VoiceChannel);
      }
      // Check if the user disconnected from a voice channel during the recursivity
      // The recursion itself. We just send the same data with the counter increased
      chaos3(counter, voiceChannel, voiceChannels, activeUsers, limit);
    }, 1500);
  } else {
    // After the final recursion, this iteration moves everyone to the
    // original channel
    activeUsers.forEach((user) => {
      user.voice.setChannel(voiceChannel);
    });
  }
}
