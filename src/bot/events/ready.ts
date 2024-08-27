import { Client } from 'discord.js';
import { join } from 'path';

import { BotEvent, Nullable } from '@marquinhos/types';
import { logger } from '@utils/logger';
import { getBicho } from '@utils/bichoGame';
import GuildModel from '@schemas/guild';
import { isDateInRange } from '@utils/dateRange';

export const ready: BotEvent = {
  name: 'ready',
  once: true,
  execute: async (client: Client) => {
    logger.info(`Logged in as ${client.user?.tag}`);
    logger.info(`Marquinhos™ is online!`);
    // Start heartbeat for bicho game
    startBichoGame(client);
    await updateAvatarBasedOnHoliday(client);
    // Marquinhos for Multiple guilds
    const guilds = client.guilds.cache.map((guild) => guild.id);
    guilds.forEach(async (guild) => {
      if (!(await GuildModel.exists({ guildID: guild }))) {
        // Config for what before was stored in the env
        let newGuild = new GuildModel({
          guildID: guild,
          options: {
            prefix: process.env.MARQUINHOS_PREFIX,
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

function startBichoGame(client: Client) {
  client.user?.setActivity(getBicho());
  setInterval(function () {
    client.user?.setActivity(getBicho());
  }, 100 * 1000);
}

async function updateAvatarBasedOnHoliday(client: Client) {
  const avatar = getAvatar(client.user?.avatar);
  if (!avatar) return;
  await client.user?.setAvatar(
    join(__dirname, `../../resources/images/${avatar}`)
  );
}

function getAvatar(avatarHash: Nullable<string>) {
  const regularAvatar = 'marquinhoshead.jpg';
  const regularAvatarHash = '3b124d750ce2a473031e559993179653';

  const christmasAvatar = 'marquinhosnatal.png';
  const christmasAvatarHash = 'b4b215d7e3176ce99b73097c7f3d5985';
  const christmasStartDate = '27/11';
  const christmasEndDate = '06/01';

  const halloweenAvatar = 'marquinhos_halloween.png';
  const halloweenAvatarHash = '40aab1d039453c791474e772c18bb6a0';
  const halloweenStartDate = '24/10';
  const halloweenEndDate = '06/11';

  const developmentAvatar = 'marquinhosneo.png';
  const developmentAvatarHash = '4bb3b86b9e7e3cd7d3de071a97e468ae';

  if (process.env.NODE_ENV !== 'production') {
    if (avatarHash === developmentAvatarHash) {
      return null;
    }
    return developmentAvatar;
  }

  if (isDateInRange(halloweenStartDate, halloweenEndDate)) {
    if (avatarHash === halloweenAvatarHash) {
      return null;
    }
    return halloweenAvatar;
  } else if (isDateInRange(christmasStartDate, christmasEndDate)) {
    if (avatarHash === christmasAvatarHash) {
      return null;
    }
    return christmasAvatar;
  }
  if (avatarHash === regularAvatarHash) {
    return null;
  }
  return regularAvatar;
}
