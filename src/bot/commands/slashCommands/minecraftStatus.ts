import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
  TextChannel,
  Snowflake,
} from 'discord.js';
import * as util from 'minecraft-server-util';

import { SlashCommand } from '@marquinhos/types';
import MinecraftServerStatus from '@utils/minecraftServerStatus';
import MinecraftServerModel from '@schemas/minecraftServers';

export const minecraftStatus: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('minecraft-status')
    .setDescription(
      'Cria um monitoramento de status de um servidor de minecraft'
    )
    .addStringOption((option) =>
      option
        .setName('ip')
        .setDescription('O host do servidor de minecraft')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('port')
        .setDescription('A porta do servidor de minecraft')
        .setRequired(true)
    ),
  execute: async (interaction) => {
    let status = null;

    const minecraftServer = MinecraftServerStatus.getInstance();

    const ip = interaction.options.get('ip')?.value as string;
    const port = interaction.options.get('port')?.value as number;
    const guildID = interaction.guildId as string;
    const minecraftStatusBaseEmbed = interaction.client.baseEmbed();

    if (!guildID) {
      await interaction.reply({
        embeds: [
          minecraftStatusBaseEmbed
            .setTitle(`Falha ao criar o monitoramento!`)
            .setDescription(
              `Não foi possível encontrar o ID do servidor de discord!`
            ),
        ],
      });
      return;
    }

    try {
      status = await util.queryFull(ip, port);
    } catch (error) {
      await interaction.reply({
        embeds: [
          minecraftStatusBaseEmbed
            .setTitle(`Falha ao criar o monitoramento!`)
            .setDescription(
              `Não foi possível conectar ao servidor de minecraft!`
            ),
        ],
      });
      return;
    }

    const minecraftStatusChannel =
      (await interaction.guild?.channels.cache.find(
        (channel) => channel.name === 'minecraft-status'
      )) as TextChannel;

    const statusChannel =
      minecraftStatusChannel ??
      (await interaction.guild?.channels.create({
        name: 'minecraft-status',
        type: ChannelType.GuildText,
        topic: 'Status dos servidores de minecraft',
        permissionOverwrites: [
          {
            id: interaction.guildId as Snowflake,
            deny: [PermissionsBitField.Flags.SendMessages],
          },
        ],
      }));

    const existingServer = await MinecraftServerModel.findOne({
      guildID,
      channelID: statusChannel.id,
      host: ip,
      port,
    });

    if (existingServer) {
      await interaction.reply({
        embeds: [
          minecraftStatusBaseEmbed
            .setTitle(`Servidor já está sendo monitorado!`)
            .setDescription(
              `O servidor já tem status em <#${statusChannel.id}>`
            ),
        ],
      });
      return;
    }

    const minecraftStatusEmbed =
      minecraftServer.generateMinecraftStatusEmbed(status);

    const messageEmbed = await statusChannel.send({
      embeds: [minecraftStatusEmbed],
    });

    await minecraftServer.addNewServer({
      guildID,
      channelID: statusChannel.id,
      messageID: messageEmbed.id,
      host: ip,
      port,
    });

    await interaction.reply({
      embeds: [
        minecraftStatusBaseEmbed
          .setTitle(`Monitoramento do servidor de minecraft criado!`)
          .setDescription(
            `Agora você pode ver o status do servidor de minecraft em tempo real em <#${statusChannel.id}>`
          ),
      ],
    });
  },
  cooldown: 10,
};
