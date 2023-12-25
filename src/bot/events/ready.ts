import { Client } from 'discord.js';
import { join } from 'path';

import { BotEvent } from '@marquinhos/types';
import GuildModel from '@schemas/guild';
import { getBicho } from '@utils/bichoGame';
import { isDateInRange } from '@utils/dateRange';
import { logger } from '@utils/logger';

export const ready: BotEvent = {
  name: 'ready',
  once: true,
  execute: async (client: Client) => {
    logger.info(`Logged in as ${client.user?.tag}`);
    logger.info(`Marquinhos™ is online!`);
    // Start heartbeat for bicho game
    if (process.env.NODE_ENV === 'production') {
      startBichoGame(client);
    } else {
      client.user.setActivity(`${getRandomGame()}`);
    }
    await updateAvatarBasedOnHoliday(client);
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

function startBichoGame(client: Client) {
  client.user.setActivity(getBicho());
  setInterval(function () {
    client.user.setActivity(getBicho());
  }, 100 * 1000);
}

async function updateAvatarBasedOnHoliday(client: Client) {
  const avatar = getAvatar(client?.user.avatar);
  if (!avatar) return;
  await client.user.setAvatar(
    join(__dirname, `../../resources/images/${avatar}`)
  );
}

function getAvatar(avatarHash: string | null) {
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

function getRandomGame() {
  const games = [
    'Among Us',
    'Valorant',
    'League of Legends',
    'Minecraft',
    'Counter-Strike: Global Offensive',
    'Rocket League',
    'Apex Legends',
    'Fortnite',
    'Genshin Impact',
    'Grand Theft Auto V',
    'Call of Duty: Warzone',
    'FIFA 21',
    'Rust',
    'Phasmophobia',
    'Cyberpunk 2077',
    'Dead by Daylight',
    'Destiny 2',
    'Dota 2',
    'Fall Guys',
    'Overwatch',
    'PUBG',
    'Rainbow Six Siege',
    'Sea of Thieves',
    'The Sims 4',
    'Team Fortress 2',
    'Terraria',
    'World of Warcraft',
    'World of Tanks',
    'Hearthstone',
    'Path of Exile',
    'RuneScape',
    'Arma 3',
    'Smite',
    'Forza Horizon 4',
    'Brawlhalla',
    'Mortal Kombat 11',
    'Starcraft II',
    'Warframe',
    'Magic: The Gathering Arena',
    'Chess',
    'Halo: The Master Chief Collection',
    'Farming Simulator 19',
  ];

  return games[Math.floor(Math.random() * games.length)];
}
