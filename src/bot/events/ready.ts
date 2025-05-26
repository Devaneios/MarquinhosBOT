import { Client } from 'discord.js';

import { BotEvent } from '@marquinhos/types';
import { getBicho } from '@marquinhos/utils/bichoGame';
import { logger } from '@marquinhos/utils/logger';

export const ready: BotEvent = {
  name: 'ready',
  once: true,
  execute: async (client: Client) => {
    logger.info(`Logged in as ${client.user?.tag}`);
    logger.info(`Marquinhos™ is online!`);
    // Start heartbeat for bicho game
    startBichoGame(client);
  },
};

function startBichoGame(client: Client) {
  client.user?.setActivity(getBicho());
  setInterval(function () {
    client.user?.setActivity(getBicho());
  }, 100 * 1000);
}
