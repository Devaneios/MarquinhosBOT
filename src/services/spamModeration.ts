import { GuildConfig } from '@marquinhos/config/guild';
import { logger } from '@marquinhos/utils/logger';
import { createHash } from 'crypto';

interface BufferedSpamMessage {
  messageId: string;
  userId: string;
  channelId: string;
  hash: string;
  timestamp: number;
  deleted: boolean;
}

interface SpamModerationMember {
  presence?: { status?: string | null } | null;
  user: { tag: string };
  createDM(): Promise<{ send(payload: { content: string }): Promise<unknown> }>;
}

interface SpamModerationMemberCollection {
  size: number;
  filter(
    predicate: (member: SpamModerationMember) => boolean,
  ): SpamModerationMemberCollection;
  random(): SpamModerationMember | undefined;
}

interface SpamModerationRole {
  members: SpamModerationMemberCollection;
}

interface SpamModerationChannel {
  messages?: {
    fetch(
      messageId: string,
    ): Promise<{ delete(): Promise<unknown> | unknown } | null | undefined>;
  };
}

export interface SpamModerationMessage {
  id: string;
  content: string;
  channelId: string;
  author: {
    id: string;
    bot?: boolean;
    tag?: string;
  };
  member?: {
    timeout?(duration: number, reason?: string): Promise<unknown> | unknown;
  } | null;
  guild?: {
    name: string;
    roles?: {
      fetch(roleId: string): Promise<SpamModerationRole | null>;
    };
  } | null;
  client: {
    channels: {
      cache: {
        get(channelId: string): unknown;
      };
    };
  };
  delete(): Promise<unknown> | unknown;
}

export interface SpamModerationOptions {
  windowMs?: number;
  timeoutMs?: number;
  maxBufferSize?: number;
  modRoleId?: string;
  now?: () => number;
}

export class SpamModerationService {
  private readonly windowMs: number;
  private readonly timeoutMs: number;
  private readonly maxBufferSize: number;
  private readonly modRoleId: string;
  private readonly now: () => number;
  private readonly messageBuffer: BufferedSpamMessage[] = [];

  constructor(options: SpamModerationOptions = {}) {
    this.windowMs = options.windowMs ?? 5000;
    this.timeoutMs = options.timeoutMs ?? 604800000;
    this.maxBufferSize = options.maxBufferSize ?? 500;
    this.modRoleId = options.modRoleId ?? GuildConfig.MOD_ROLE_ID;
    this.now = options.now ?? Date.now;
  }

  async handleMessage(message: SpamModerationMessage) {
    if (message.author.bot) return;

    const messageContent = message.content.trim();
    if (!messageContent) return;

    const now = this.now();
    this.purgeExpiredMessages(now);

    const userId = message.author.id;
    const messageHash = this.hashMessage(messageContent, userId);
    const duplicateMessage = this.messageBuffer.find(
      (bufferedMessage) =>
        bufferedMessage.hash === messageHash &&
        bufferedMessage.userId === userId &&
        bufferedMessage.channelId !== message.channelId &&
        now - bufferedMessage.timestamp <= this.windowMs,
    );

    if (duplicateMessage) {
      await this.handleDuplicateMessage(message, duplicateMessage, now);
      return;
    }

    this.messageBuffer.push({
      messageId: message.id,
      userId,
      channelId: message.channelId,
      hash: messageHash,
      timestamp: now,
      deleted: false,
    });

    if (this.messageBuffer.length > this.maxBufferSize) {
      this.messageBuffer.splice(
        0,
        this.messageBuffer.length - this.maxBufferSize,
      );
    }
  }

  private purgeExpiredMessages(now: number) {
    const firstActiveIndex = this.messageBuffer.findIndex(
      (message) => now - message.timestamp <= this.windowMs,
    );

    if (firstActiveIndex === -1) {
      this.messageBuffer.length = 0;
      return;
    }

    if (firstActiveIndex > 0) {
      this.messageBuffer.splice(0, firstActiveIndex);
    }
  }

  private hashMessage(content: string, userId: string) {
    return createHash('sha256').update(`${content}${userId}`).digest('hex');
  }

  private async handleDuplicateMessage(
    message: SpamModerationMessage,
    duplicateMessage: BufferedSpamMessage,
    now: number,
  ) {
    const userId = message.author.id;

    try {
      await message.delete();
      duplicateMessage.timestamp = now;

      if (!duplicateMessage.deleted) {
        const originalChannel = message.client.channels.cache.get(
          duplicateMessage.channelId,
        ) as SpamModerationChannel | undefined;
        const originalMessage = await originalChannel?.messages?.fetch(
          duplicateMessage.messageId,
        );
        await originalMessage?.delete();
        duplicateMessage.deleted = true;
      }

      await message.member?.timeout?.(this.timeoutMs, 'Spam detected');
      logger.warn(`Deleted spam messages from ${message.author.tag ?? userId}`);
    } catch (error) {
      logger.error('Failed to handle spam message:', error);
    } finally {
      await this.notifyModeratorAboutSpam(message, userId);
    }
  }

  private async notifyModeratorAboutSpam(
    message: SpamModerationMessage,
    spammerId: string,
  ) {
    try {
      const guild = message.guild;
      if (!guild) return;

      const modRole = await guild.roles?.fetch(this.modRoleId);
      if (!modRole || modRole.members.size === 0) return;

      const availableMods = modRole.members.filter(
        (member) =>
          Boolean(member.presence?.status) &&
          member.presence?.status !== 'offline',
      );

      const modToNotify =
        availableMods.size > 0
          ? availableMods.random()
          : modRole.members.random();

      if (!modToNotify) return;

      const dmChannel = await modToNotify.createDM();
      await dmChannel.send({
        content: `Spam detected from **${message.author.tag ?? spammerId}** (<@${spammerId}>) in server ${guild.name}. User has been timed out for 7 days.`,
      });
    } catch (error) {
      logger.error('Failed to notify moderator about spam:', error);
    }
  }
}

export const spamModerationService = new SpamModerationService();
