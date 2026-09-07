import { Precondition } from '@sapphire/framework';
import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionsBitField,
} from 'discord.js';

export class CanJoinPrecondition extends Precondition {
  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    const member = interaction.member;
    if (!member || !('voice' in member)) {
      return this.error({ message: 'Você precisa estar em um canal de voz!' });
    }
    const voiceChannel = (member as GuildMember).voice.channel;
    if (!voiceChannel) {
      return this.error({ message: 'Você precisa estar em um canal de voz!' });
    }
    const canJoin = interaction.guild?.members.me
      ?.permissionsIn(voiceChannel)
      .has(PermissionsBitField.Flags.Connect);
    return canJoin
      ? this.ok()
      : this.error({
          message: 'Eu não tenho permissão para entrar nesse canal de voz!',
        });
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    CanJoin: never;
  }
}
