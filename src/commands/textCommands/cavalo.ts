import { Message } from 'discord.js';
import { Command } from '../../types';
import { join } from 'path';

export const cavalo: Command = {
  name: 'cavalo',
  execute: (message: Message) => {
    message.channel.send({
      files: [
        {
          attachment: join(__dirname, '../resources/animations/cavalo.gif'),
          name: 'cavalo.gif',
          description: 'CAVALO',
        },
      ],
    });
  },
  cooldown: 10,
  aliases: [],
  permissions: [],
};
