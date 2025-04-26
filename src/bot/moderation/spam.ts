import { BufferedMessage } from '@marquinhos/types';
import crypto from 'crypto';
import { Message, TextChannel } from 'discord.js';

const messageBuffer: BufferedMessage[] = [];
const BUFFER_EXPIRY_MS = 5000;
const CLEAN_INTERVAL_MS = 30000;
const MOD_ROLE_ID = '598322611877052462';

setInterval(() => {
  const now = Date.now();
  const expiredIndex = messageBuffer.findIndex(
    (msg) => now - msg.timestamp > BUFFER_EXPIRY_MS
  );

  if (expiredIndex !== -1) {
    messageBuffer.splice(0, expiredIndex + 1);
  }
}, CLEAN_INTERVAL_MS);

function hashMessage(content: string, userId: string): string {
  return crypto.createHash('md5').update(`${content}${userId}`).digest('hex');
}

async function notifyModeratorAboutSpam(
  message: Message,
  spammerTag: string,
  spammerId: string
) {
  try {
    const guild = message.guild;
    if (!guild) return;

    const modRole = await guild.roles.fetch(MOD_ROLE_ID);
    if (!modRole) {
      console.log('Moderator role not found');
      return;
    }

    const moderators = modRole.members;
    if (moderators.size === 0) {
      console.log('No moderators found');
      return;
    }

    const availableMods = moderators.filter(
      (mod) => mod.presence?.status && mod.presence.status !== 'offline'
    );

    const modToNotify =
      availableMods.size > 0 ? availableMods.random() : moderators.random();

    if (modToNotify) {
      const dmChannel = await modToNotify.createDM();
      await dmChannel.send({
        content: `Spam detected from **${spammerTag}** (<@${spammerId}>) in server ${guild.name}. User has been timed out for 7 days.`,
      });

      console.log(`Notified moderator ${modToNotify.user.tag} about spam`);
    }
  } catch (error) {
    console.error('Failed to notify moderator:', error);
  }
}

export function handlePotentialSpam(message: Message) {
  const messageContent = message.content.trim();
  const userId = message.author.id;
  const messageHash = hashMessage(messageContent, userId);
  const now = Date.now();

  const duplicateMessage = messageBuffer.find(
    (msg) =>
      msg.hash === messageHash &&
      msg.userId === userId &&
      msg.channelId !== message.channelId &&
      now - msg.timestamp <= BUFFER_EXPIRY_MS
  );

  if (duplicateMessage) {
    return handleDuplicateMessage(message, duplicateMessage, userId, now);
  } else {
    messageBuffer.push({
      messageId: message.id,
      userId,
      channelId: message.channelId,
      hash: messageHash,
      timestamp: now,
      deleted: false,
    });
  }
}

async function handleDuplicateMessage(
  message: Message,
  duplicateMessage: BufferedMessage,
  userId: string,
  now: number
) {
  try {
    await message.delete();
    duplicateMessage.timestamp = now;

    if (!duplicateMessage.deleted) {
      const originalChannel = message.client.channels.cache.get(
        duplicateMessage.channelId
      ) as TextChannel;
      const originalMessage = await originalChannel?.messages.fetch(
        duplicateMessage.messageId
      );
      await originalMessage?.delete();
      duplicateMessage.deleted = true;
    }

    console.log(`Deleted spam messages from ${message.author.tag} (${userId})`);

    await message.member?.timeout(604800000, 'Spam detected');
  } catch (error) {
    console.error('Failed to delete spam messages:', error);
  } finally {
    await notifyModeratorAboutSpam(message, message.author.tag, userId);
  }
}
