import { Message } from 'discord.js';
import { Command } from '../../types';
import { join } from 'path';

export const olavac: Command = {
  name: 'olavac',
  execute: (message: Message) => {
    message.channel.send({
      files: [
        {
          attachment: join(__dirname, '../resources/animations/olavac.gif'),
          name: 'olavac.gif',
          description: 'Oirártnoc',
        },
      ],
    });
  },
  cooldown: 10,
  aliases: [],
  permissions: [],
};
