import {
  ChannelType,
  Client,
  GuildMember,
  Message,
  TextChannel,
} from 'discord.js';
import dotenv from 'dotenv';
import FuzzySearch from 'fuzzy-search';

import { checkPermissions, sendTimedMessage } from 'src/utils/discord';
import { BotEvent } from 'src/types';
import { logger } from 'src/utils/logger';
import { safeExecute } from 'src/utils/errorHandling';
import { musicBotMessageHandler } from 'src/utils/lastfm';
import SilencedModel from 'src/database/schemas/silenced';
import BotError from 'src/utils/botError';

dotenv.config();

export const messageCreate: BotEvent = {
  name: 'messageCreate',
  execute: async (message: Message) => {
    const prefix = process.env.PREFIX;
    const timedMessageDuration = 10000;

    if (message.channel instanceof TextChannel && message.author.bot) {
      try {
        await musicBotMessageHandler(message);
      } catch (error) {
        throw error;
      }
    }
    if (!message.member) return;
    if (!message.guild) return;
    if (!message.content.startsWith(prefix)) {
      secretChannelMessageHandler(message);
      await silencedUserHandler(message);
      return;
    }

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
        const mapedCommands = commandList.map((command) => command.name);
        const searcher = new FuzzySearch(mapedCommands, undefined, {
          sort: true,
        });
        const result = searcher.search(args[0]);
        if (result.length > 0) {
          message.channel.send(`Você quis dizer: **${prefix}${result[0]}** ?`);
        }
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
      sendTimedMessage(
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
        sendTimedMessage(
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
    safeExecute(command.execute, message, args)();
  },
};

const secretChannelMessageHandler = (message: Message) => {
  const { secretChannels } = message.guild?.client as Client;
  const { id } = message.author;
  const secretChannel = secretChannels.get(id);
  if (secretChannel) {
    if (
      secretChannel.channel === message.channel &&
      secretChannel.finishesAt > new Date()
    ) {
      secretChannel.messages.next(message);
    }
  }
};

async function silencedUserHandler(message: Message) {
  if (await isUserSilenced(message.member as GuildMember)) {
    await message.delete();
    const channel = message.channel;
    sendTimedMessage('Silêncio.', channel as TextChannel, 1000);
  }
}

async function isUserSilenced(member: GuildMember) {
  return await SilencedModel.collection.findOne({
    id: member.id,
    user: member.user.username,
  });
}
