import { Client } from 'discord.js';
import { BotEvent } from '../types';
import { logger } from '../utils/logger';
import { getBicho } from '../utils/bichoGame';
import GuildModel from '../database/schemas/guild';

export const ready: BotEvent = {
  name: 'ready',
  once: true,
  execute: (client: Client) => {
    logger.info(`Logged in as ${client.user?.tag}`);
    logger.info(`Marquinhos™ is online!`);
    // Start heartbeat for bicho game
    startBichoGame(client);
    // Marquinhos for Multiple guilds
    const guilds = client.guilds.cache.map((guild) => guild.id);
    guilds.forEach(async (guild) => {
      if (!(await GuildModel.exists({ guildID: guild }))) {
        // Config for what before was stored in the env
        let newGuild = new GuildModel({
          guildID: guild,
          options: {
            prefix: process.env.PREFIX,
            VIP_ROLE_NAME: null,
            BASE_ROLE_NAME: null,
            EXTERNAL_ROLE_NAME: null,
            ROULETTE_ROLE_NAME: null,
          },
          roulette: {
            isRouletteOn: false,
            rouletteAdmins: [],
          },
          joinedAt: Date.now(),
        });
        newGuild.save();
      }
    });
  },
};

async function startBichoGame(client: Client) {
  client.user.setActivity(getBicho());
  setInterval(function () {
    client.user.setActivity(getBicho());
  }, 100 * 1000);
}
