import { BotErrorLogLevel } from '@marquinhos/types';
import { CommandInteraction, Message } from 'discord.js';

class BotError extends Error {
  discordMessage: Message | CommandInteraction;
  logLevel: BotErrorLogLevel = 'error';
  origin = 'Unknown';

  constructor(
    message: string,
    discordMessage: Message | CommandInteraction,
    logLevel?: BotErrorLogLevel,
    origin: string = 'Unknown',
  ) {
    super(message);
    this.name = 'MarquinhosError';
    this.discordMessage = discordMessage;
    this.logLevel = logLevel ?? 'error';
    this.origin = origin;
  }
}

export default BotError;
