import { Guild } from 'discord.js';

import { BotEvent } from '@marquinhos/types';

export const guildCreate: BotEvent = {
  name: 'guildCreate',
  execute: (guild: Guild) => {},
};
