import { Precondition } from '@sapphire/framework';
import { ChatInputCommandInteraction, GuildMember } from 'discord.js';

export class BotNotInOtherChannelPrecondition extends Precondition {
  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    const member = interaction.member;
    if (!member || !('voice' in member)) {
      return this.error({ message: 'Você precisa estar em um canal de voz!' });
    }
    const userChannel = (member as GuildMember).voice.channel;
    if (!userChannel) {
      return this.error({ message: 'Você precisa estar em um canal de voz!' });
    }
    const botChannel = interaction.guild?.members.me?.voice.channel;
    if (botChannel && botChannel.id !== userChannel.id) {
      return this.error({
        message: 'Eu já estou conectado em outro canal de voz!',
      });
    }
    return this.ok();
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    BotNotInOtherChannel: never;
  }
}
