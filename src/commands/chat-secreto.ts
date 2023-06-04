import { Client, Message, TextChannel } from 'discord.js';
import { Subject, delay } from 'rxjs';
import { Command, SafeAny, SecretChannelData } from '../types';
import { sendTimedMessage } from '../utils/discord';
import { coerceNumberProperty } from '../utils/coercion';

const command: Command = {
  name: 'chat-secreto',
  execute: (message: Message, args: string[]) => {
    const incommingChannel = message.channel as TextChannel;
    const authorId = message.author.id;
    const { secretChannels } = message.guild?.client as Client;
    message.delete();

    if (secretChannelAlredyExists(secretChannels, authorId, incommingChannel)) {
      return;
    }

    // Anti-troll (Guilh*rm*) parse
    const durationInMinutes = coerceNumberProperty(args[1], 0);

    if (!isDurationValid(durationInMinutes, incommingChannel)) {
      return;
    }

    activateSecretChannel(
      secretChannels,
      authorId,
      incommingChannel,
      durationInMinutes
    );

    scheduleDeactivationNotification(incommingChannel, durationInMinutes);
    scheduleSecretChannelDeactivation(
      secretChannels,
      authorId,
      durationInMinutes
    );

    sendTimedMessage(
      `Ok, liguei o modo secreto por ${durationInMinutes} ${
        durationInMinutes === 1 ? 'minuto' : 'minutos'
      }`,
      incommingChannel,
      10000
    );
  },
  cooldown: 1,
  aliases: ['secreto'],
  permissions: [],
};

const secretChannelAlredyExists = (
  secretChannels: Map<string, SecretChannelData>,
  authorId: string,
  incommingChannel: TextChannel
) => {
  if (secretChannels.get(authorId)) {
    sendTimedMessage(
      `Já tá ligado vei, ${
        secretChannels.get(authorId)?.channel === incommingChannel
          ? 'aqui nesse canal mesmo, fala teus podre aí'
          : `lá no ${
              secretChannels.get(authorId)?.channel
            }. Fala teus podre lá.`
      }`,
      incommingChannel,
      10000
    ); // It deletes the message, again, to keep it secret
    return true;
  }
  return false;
};

const isDurationValid = (
  durationInMinutes: number,
  incommingChannel: TextChannel
) => {
  if (durationInMinutes <= 0 || durationInMinutes > 10) {
    sendTimedMessage(
      'E isso é tempo útil, bixo (entre 1 e 10 minutos, né...)',
      incommingChannel,
      10000
    ); // It deletes the message after 10 seconds, to keep it secret :x;
    return false;
  }
  return true;
};

const activateSecretChannel = (
  secretChannels: Map<string, SecretChannelData>,
  authorId: string,
  incommingChannel: TextChannel,
  durationInMinutes: number
) => {
  secretChannels.set(authorId, {
    channel: incommingChannel,
    startedAt: new Date(),
    finishesAt: new Date(Date.now() + durationInMinutes * 60 * 1000),
    messages: new Subject<Message>(),
  });

  secretChannels
    .get(authorId)
    ?.messages.pipe(delay(10000))
    .subscribe((newMessage) => {
      newMessage.delete();
    });
};

const scheduleDeactivationNotification = (
  incommingChannel: TextChannel,
  durationInMinutes: number
) => {
  setTimeout(() => {
    sendTimedMessage(
      'Tô desligando o chat-secreto em 10 segundos, viu',
      incommingChannel,
      10000
    );
  }, durationInMinutes * 60 * 1000 - 10000); // It sends a warning 10 seconds before it deactivates itself
};

const scheduleSecretChannelDeactivation = (
  secretChannels: Map<string, SecretChannelData>,
  authorId: string,
  durationInMinutes: number
) => {
  setTimeout(() => {
    secretChannels.get(authorId)?.messages.complete();
    secretChannels.delete(authorId);
  }, durationInMinutes * 60 * 1000); // At last, the feature deactivates itself
};

export default command;
