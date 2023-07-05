import {
  Collection,
  CommandInteraction,
  GuildBasedChannel,
  GuildMember,
  SlashCommandBuilder,
  VoiceBasedChannel,
  VoiceChannel,
} from 'discord.js';
import { SlashCommand } from '../../types';
import { coerceNumberProperty } from '../../utils/coercion';
import { playAudio } from '../../utils/discord';

export const chaos: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('chaos')
    .setDescription('Instaura o CHAOS nos canais de voz')
    .setDefaultMemberPermissions(0)
    .addStringOption((option) =>
      option
        .setName('nivel_do_chaos')
        .setDescription('O quão caótico você precisa que fique.')
        .setRequired(false)
    ),
  execute: async (interaction) => {
    // Gets the audioPlayer to execute the command only after the audio finishes
    // playing
    // const audioPlayer = BotAudioPlayer.getInstance();
    // Defines the level of chaos, as a number
    const levelOfChaos = coerceNumberProperty(
      interaction.options.get('nivel_do_chaos')?.value,
      10
    );
    // Maxes the number to 25, since more would take too much time
    if (levelOfChaos > 25) {
      interaction.reply(
        'Não posso fazer isso, vocês não aguentariam tamanho caos!'
      );
      return;
    }
    // Voice channel to get current voice channel
    const currentVoiceChannel = (interaction.member as GuildMember).voice
      .channel;
    // If the user is not in a voice channel, it doens't work
    if (!currentVoiceChannel) {
      interaction.reply('Você precisa estar em um canal de voz!');
      return;
    }
    // Plays the audio to start chaos
    playAudio(interaction, currentVoiceChannel, '_caos');
    
    //When the audio finishes playing, call the function
    //audioPlayer.player.on(AudioPlayerStatus.Idle, () => {
    chaos2(interaction, levelOfChaos);
    //});
    
    interaction.reply('É TILAMBUCOOOOOOO');
    interaction.deleteReply();
  },
  cooldown: 10,
};

async function chaos2(interaction: CommandInteraction, limit: number) {
  // Voice channel enum to filter all available channels
  const voiceChannelEnumNumber = 2;
  // Gets the voice channel that will (primaly) suffer the chaos
  const voiceChannel = (interaction.member as GuildMember).voice.channel;
  // Gets the list of all voice channels in the guild
  const voiceChannels = interaction.guild?.channels.cache.filter(
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
    interaction.channel!.send('Desculpe, mas houve um erro na execução.');
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
    }, 1000);
  } else {
    // After the final recursion, this iteration moves everyone to the
    // original channel
    activeUsers.forEach((user) => {
      user.voice.setChannel(voiceChannel);
    });
  }
}
