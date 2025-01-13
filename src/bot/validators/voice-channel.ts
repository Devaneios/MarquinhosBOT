import {
  CommandInteraction,
  GuildMember,
  PermissionsBitField,
} from 'discord.js';

export const isUserInVoiceChannel = async (
  interaction: CommandInteraction
): Promise<boolean> => {
  const voiceChannel = (interaction.member as GuildMember).voice.channel;

  if (!voiceChannel) {
    await interaction.reply(
      'Você precisa estar em um canal de voz para usar esse comando!'
    );
    return false;
  }

  return true;
};

export const isCurrentlyInVoiceChannel = async (
  interaction: CommandInteraction
): Promise<boolean> => {
  const voiceChannel = (interaction.member as GuildMember).voice.channel!;
  if (
    interaction?.guild?.members.me?.voice.channel &&
    interaction.guild.members.me.voice.channel !== voiceChannel
  ) {
    await interaction.reply('Eu já estou conectado em outro canal de voz!');
    return false;
  }
  return true;
};

export const canSpeakVoiceChannel = async (
  interaction: CommandInteraction
): Promise<boolean> => {
  const voiceChannel = (interaction.member as GuildMember).voice.channel!;
  if (
    !interaction.guild?.members.me
      ?.permissionsIn(voiceChannel)
      .has(PermissionsBitField.Flags.Speak)
  ) {
    await interaction.reply(
      'Eu não tenho permissão para falar nesse canal de voz!'
    );
    return false;
  }
  return true;
};

export const canJoinVoiceChannel = async (
  interaction: CommandInteraction
): Promise<boolean> => {
  const voiceChannel = (interaction.member as GuildMember).voice.channel!;
  if (
    !interaction.guild?.members.me
      ?.permissionsIn(voiceChannel)
      .has(PermissionsBitField.Flags.Connect)
  ) {
    await interaction.reply(
      'Eu não tenho permissão para entrar nesse canal de voz!'
    );
    return false;
  }
  return true;
};
