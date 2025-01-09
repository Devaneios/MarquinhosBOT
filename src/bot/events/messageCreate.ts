import { ChannelType, Message, TextChannel } from 'discord.js';
import dotenv from 'dotenv';

import { BotEvent } from '@marquinhos/types';
import BotError from '@marquinhos/utils/botError';
import { checkPermissions, sendTimedMessage } from '@marquinhos/utils/discord';
import { safeExecute } from '@marquinhos/utils/errorHandling';
import { logger } from '@marquinhos/utils/logger';

dotenv.config();

export const messageCreate: BotEvent = {
  name: 'messageCreate',
  execute: async (message: Message) => {
    const prefix = process.env.MARQUINHOS_PREFIX;
    const timedMessageDuration = 10000;

    if (message.channel instanceof TextChannel && message.author.bot) {
      return;
    }
    if (!message.member) return;
    if (!message.guild) return;

    if (message.channel.type !== ChannelType.GuildText) return;

    let args = message.content.substring(prefix.length).split(' ');
    let command = message.client.commands.get(args[0]);

    if (!command) {
      const commandList = message.client.commands;
      let commandFromAlias = commandList.find((command) =>
        command.aliases.includes(args[0])
      );
      if (commandFromAlias) command = commandFromAlias;
      else {
        throw new BotError('Command not found', message, 'info');
      }
    }

    let cooldown = message.client.cooldowns.get(
      `${command.name}-${message.member.user.username}`
    );
    let neededPermissions = checkPermissions(
      message.member,
      command.permissions
    );
    if (neededPermissions !== null) {
      await sendTimedMessage(
        `
            Você não tem permissão para usar esse comando. 
            \n Permissões necessárias: ${neededPermissions.join(', ')}
            `,
        message.channel,
        timedMessageDuration
      );
      throw new BotError(
        `${message.member?.user.username} missed permissions`,
        message,
        'warn'
      );
    }

    if (command.cooldown && cooldown) {
      if (Date.now() < cooldown) {
        await sendTimedMessage(
          `Vai com calma! Você pode usar esse comando novamente daqui ${Math.floor(
            Math.abs(Date.now() - cooldown) / 1000
          )} segundos.`,
          message.channel,
          timedMessageDuration
        );
        throw new BotError(
          `${message.member?.user.username} exceed cooldown`,
          message,
          'warn'
        );
      }
      message.client.cooldowns.set(
        `${command.name}-${message.member.user.username}`,
        Date.now() + command.cooldown * 1000
      );
      setTimeout(() => {
        message.client.cooldowns.delete(
          `${command?.name}-${message.member?.user.username}`
        );
      }, command.cooldown * 1000);
    } else if (command.cooldown && !cooldown) {
      message.client.cooldowns.set(
        `${command.name}-${message.member.user.username}`,
        Date.now() + command.cooldown * 1000
      );
    }
    logger.info(
      `${message.member?.user.username} executing command: ${
        args ? args.join(' ') : ''
      }`
    );
    safeExecute(command.execute.bind(this, message, args))();
  },
};
