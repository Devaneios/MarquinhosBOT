import { Precondition } from '@sapphire/framework';
import { ChatInputCommandInteraction, GuildMember } from 'discord.js';

export class UserInVoiceChannelPrecondition extends Precondition {
  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    const member = interaction.member;
    if (!member || !('voice' in member)) {
      return this.error({
        message:
          'Você precisa estar em um canal de voz para usar esse comando!',
      });
    }
    const guildMember = member as GuildMember;
    return guildMember.voice.channel
      ? this.ok()
      : this.error({
          message:
            'Você precisa estar em um canal de voz para usar esse comando!',
        });
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    UserInVoiceChannel: never;
  }
}
