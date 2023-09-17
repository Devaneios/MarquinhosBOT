import { Guild } from 'discord.js';

import GuildModel from 'src/database/schemas/guild';
import { BotEvent } from 'src/types';

export const guildCreate: BotEvent = {
  name: 'guildCreate',
  execute: (guild: Guild) => {
    let newGuild = new GuildModel({
      guildID: guild.id,
      options: {
        prefix: process.env.PREFIX,
        VIP_ROLE_NAME: null,
        BASE_ROLE_NAME: null,
        EXTERNAL_ROLE_NAME: null,
      },
      joinedAt: Date.now(),
    });
    newGuild.save();
  },
};
