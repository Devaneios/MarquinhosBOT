import {
  CommandInteraction,
  GuildMember,
  SlashCommandBuilder,
  VoiceChannel,
} from 'discord.js';

import { SlashCommand } from '@marquinhos/types';
import { playAudio } from '@utils/discord';

export const importunate: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('importunar')
    .setDescription(
      'Eu vou lá no canal de voz atazanar a vida de quem tu quiser.'
    )
    .addUserOption((option) =>
      option
        .setName('importunado')
        .setDescription('Quem você quer que eu irrite?')
        .setRequired(true)
    ),
  execute: async (interaction) => {
    const member = interaction.options.get('importunado').member as GuildMember;

    if (member.user.bot) {
      interaction.reply({ content: 'Nunca vou conseguir irritar um bot' });
      return;
    }

    if (member.voice.channel) {
      const voiceChannel = member.voice.channel as VoiceChannel;
      makeNoise(voiceChannel, interaction);
      interaction.reply({ content: `${member} AEHOOOOOOOOOOOOOO` });
    } else {
      interaction.reply({
        content: 'Acho que essa pessoa aí não tá num canal de voz..',
      });
    }
  },
  cooldown: 10,
};

function makeNoise(
  voiceChannel: VoiceChannel,
  interaction: CommandInteraction
) {
  const sounds = ['_miau', '_cabra', '_boombam'];
  playAudio(interaction, voiceChannel, sounds[Math.floor(Math.random() * 3)]);
}
