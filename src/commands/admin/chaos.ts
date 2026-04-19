import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { coerceNumberProperty } from '@marquinhos/utils/coercion';
import { Command } from '@sapphire/framework';
import {
  ChannelType,
  Collection,
  CommandInteraction,
  GuildBasedChannel,
  GuildMember,
  VoiceBasedChannel,
  VoiceChannel,
} from 'discord.js';

export const activeChaosTimers = new Set<NodeJS.Timeout>();

export class ChaosCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'chaos', cooldownDelay: 10_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Instaura o CHAOS nos canais de voz')
        .setDefaultMemberPermissions(0)
        .addStringOption((option) =>
          option
            .setName('nivel_do_chaos')
            .setDescription('O quão caótico você precisa que fique.')
            .setRequired(false),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const levelOfChaos = coerceNumberProperty(
      interaction.options.get('nivel_do_chaos')?.value,
      10,
    );
    if (levelOfChaos > 25) {
      interaction.reply(
        'Não posso fazer isso, vocês não aguentariam tamanho caos!',
      );
      return;
    }
    const currentVoiceChannel = (interaction.member as GuildMember).voice
      .channel;
    if (!currentVoiceChannel) {
      interaction.reply('Você precisa estar em um canal de voz!');
      return;
    }

    const initialTimer = setTimeout(() => {
      activeChaosTimers.delete(initialTimer);
      chaos2(interaction, levelOfChaos);
    }, 500);
    activeChaosTimers.add(initialTimer);

    await interaction.reply('É TILAMBUCOOOOOOO');
    await interaction.deleteReply();
  }
}

async function chaos2(interaction: CommandInteraction, limit: number) {
  const voiceChannel = (interaction.member as GuildMember).voice.channel;
  const voiceChannels = interaction.guild?.channels.cache.filter(
    (channel) => channel.type === ChannelType.GuildVoice,
  );
  const activeUsers = voiceChannel?.members.filter((user) => !user.user.bot);
  if (!!voiceChannel && !!voiceChannels && !!activeUsers) {
    chaos3(1, voiceChannel, voiceChannels, activeUsers, limit);
  } else {
    const textChannel = await interaction.channel?.fetch();
    if (textChannel?.type === ChannelType.GuildText) {
      textChannel.send('Desculpe, mas houve um erro na execução.');
    }
    return;
  }
}

async function chaos3(
  counter: number,
  voiceChannel: VoiceBasedChannel,
  voiceChannels: Collection<string, GuildBasedChannel>,
  activeUsers: Collection<string, GuildMember>,
  limit: number,
) {
  if (counter <= limit) {
    const timerId = setTimeout(() => {
      activeChaosTimers.delete(timerId);
      counter++;
      let usuario: GuildMember | undefined;
      const userRandomKey = activeUsers.randomKey();
      const randomVoiceChannel = voiceChannels.random();

      if (userRandomKey !== undefined && randomVoiceChannel !== undefined) {
        usuario = activeUsers.get(userRandomKey);
      }
      if (usuario !== undefined) {
        usuario.voice.setChannel(randomVoiceChannel as VoiceChannel);
      }
      chaos3(counter, voiceChannel, voiceChannels, activeUsers, limit);
    }, 1000);
    activeChaosTimers.add(timerId);
  } else {
    activeUsers.forEach((user) => {
      user.voice.setChannel(voiceChannel);
    });
  }
}
