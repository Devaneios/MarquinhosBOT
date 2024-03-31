import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import * as util from 'minecraft-server-util';

import { IMinecraftServer } from '@marquinhos/types';
import MinecraftServerModel from '@schemas/minecraftServers';

export default class MinecraftServerStatus {
  private static instance: MinecraftServerStatus;
  private _client!: Client;
  private minecraftServers!: IMinecraftServer[];
  private _status: any;
  private _interval!: NodeJS.Timeout;

  constructor() {}

  public static getInstance(): MinecraftServerStatus {
    if (!MinecraftServerStatus.instance) {
      MinecraftServerStatus.instance = new MinecraftServerStatus();
    }

    return MinecraftServerStatus.instance;
  }

  public async init(client: Client): Promise<void> {
    this._client = client;
    this.minecraftServers = await MinecraftServerModel.find().exec();
  }

  public async addNewServer(server: IMinecraftServer): Promise<void> {
    const minecraftServer = new MinecraftServerModel(server);
    await minecraftServer.save();

    this.saveMinecraftServerOnMongo(server);
  }

  async saveMinecraftServerOnMongo(server: IMinecraftServer): Promise<void> {}

  public async start(): Promise<void> {
    this._interval = setInterval(async () => {
      this.minecraftServers = await MinecraftServerModel.find().exec();
      for (const server of this.minecraftServers) {
        const options = {
          enableSRV: true,
          timeout: 10000,
        };
        try {
          const status = await util.queryFull(
            server.host,
            server.port,
            options
          );
          await this.updateMessage(
            server.guildID,
            server.channelID,
            server.messageID,
            { ...status, hostIP: server.host, hostPort: server.port }
          );
        } catch (error) {
          await this.updateMessage(
            server.guildID,
            server.channelID,
            server.messageID,
            null
          );
        }
      }
    }, 10000);
  }

  public async stop(): Promise<void> {
    clearInterval(this._interval);
  }

  private async updateMessage(
    guildId: string,
    channelId: string,
    messageId: string,
    status: util.FullQueryResponse | null
  ): Promise<void> {
    const minecraftStatusEmbed = this.generateMinecraftStatusEmbed(status);

    const guild = await this._client.guilds.fetch(guildId);

    const channel = (await guild.channels.fetch(channelId)) as TextChannel;

    const message = await channel.messages.fetch(messageId);

    if (message.author.id !== this._client.user?.id) return;

    await message.edit({
      embeds: [minecraftStatusEmbed],
    });
  }

  generateMinecraftStatusEmbed(status: util.FullQueryResponse | null) {
    const minecraftStatusBaseEmbed = this._client.baseEmbed();
    if (!status) {
      return minecraftStatusBaseEmbed
        .setTitle(`O servidor está offline!`)
        .setThumbnail('https://i.imgur.com/TSai5Im.png')
        .setColor('#ff0000')
        .setFields([
          {
            name: 'Host',
            value: 'Indisponível',
          },
          {
            name: 'Versão',
            value: 'Indisponível',
          },
          {
            name: 'Jogadores online',
            value: 'Indisponível',
          },
        ]);
    }

    return minecraftStatusBaseEmbed
      .setTitle(`${status?.motd?.clean}`)
      .setThumbnail('https://i.imgur.com/TSai5Im.png')

      .setColor(!!status ? '#00ff00' : '#ff0000')
      .setDescription(`O servidor está online!`)
      .addFields([
        {
          name: 'Host',
          value: `${status.hostIP}:${status.hostPort}`,
          inline: true,
        },
        {
          name: 'Versão',
          value: status.version,
          inline: true,
        },
        {
          name: 'Jogadores online',
          value:
            status.players.list.length > 0
              ? this.playerListWithEmojis(status.players.list).join('\n')
              : 'Ninguém online :cry:',
        },
      ])
      .setTimestamp()
      .setFooter({ text: 'Última atualização' });
  }

  private playerListWithEmojis(players: string[]): string[] {
    const emojis = [
      ':fire:',
      ':crossed_swords:',
      ':shield:',
      ':bow_and_arrow:',
      ':pick:',
      ':axe:',
      ':hammer:',
      ':fishing_pole_and_fish:',
      ':seedling:',
      ':mushroom:',
      ':bread:',
      ':apple:',
      ':cake:',
      ':cookie:',
      ':melon:',
      ':potato:',
      ':carrot:',
      ':cactus:',
      ':bamboo:',
      ':bone:',
      ':skull:',
      ':spider:',
      ':spider_web:',
      ':cavaloemoji:',
    ];

    const randomIndex = () => Math.floor(Math.random() * 1000) % emojis.length;

    return players.map((player) => `${emojis[randomIndex()]} ${player}`);
  }
}
