import { Message } from 'discord.js';
import { Command } from '../../types';
import { checkInReply } from '../helpers/checkInHelper';

export const checkIn: Command = {
  name: 'check-in',
  execute: (message: Message, args: string[]) => {
    const member = message.member;
    const guildName = message.guild.name;
    message.reply(checkInReply(member, guildName));
  },
  cooldown: 10,
  aliases: [],
  permissions: [],
};
