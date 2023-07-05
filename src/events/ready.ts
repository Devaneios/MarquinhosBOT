import { Client } from 'discord.js';
import { BotEvent } from '../types';
import { logger } from '../utils/logger';
import GuildModel from '../schemas/guild';

export const ready: BotEvent = {
  name: 'ready',
  once: true,
  execute: (client: Client) => {
    logger.info(`Logged in as ${client.user?.tag}`);
    logger.info(`Marquinhos™ is online!`);

    const guilds = client.guilds.cache.map((guild) => guild.id);

    guilds.forEach(async (guild) => {
      if (await GuildModel.exists({ guildID: guild })) return;
      let newGuild = new GuildModel({
        guildID: guild,
        options: {
          prefix: process.env.PREFIX,
          VIP_ROLE_NAME: null,
          BASE_ROLE_NAME: null,
          EXTERNAL_ROLE_NAME: null,
        },
        joinedAt: Date.now(),
      });
      newGuild.save();
    });
  },
};
