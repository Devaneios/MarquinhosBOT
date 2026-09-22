import { Precondition } from '@sapphire/framework';
import { ChatInputCommandInteraction, GuildMember } from 'discord.js';

export class UserInVoiceChannelPrecondition extends Precondition {
  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    const member = interaction.member;
    if (!(member instanceof GuildMember)) {
      return this.error({
        message:
          'Você precisa estar em um canal de voz para usar esse comando!',
      });
    }
    return member.voice.channel
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
