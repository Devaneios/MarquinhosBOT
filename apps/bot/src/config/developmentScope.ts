import { env } from './environment';
import { GuildConfig } from './guild';

interface ChannelContext {
  guildId?: string | null;
  channelId: string | null;
  channel?: { isThread?(): boolean; parentId?: string | null } | null;
}

interface DevelopmentConfig {
  NODE_ENV: string;
  DEV_TEST_CHANNEL_ID?: string;
}

export function isDevelopmentChannelAllowed(
  context: ChannelContext,
  config: DevelopmentConfig = env,
): boolean {
  if (config.NODE_ENV !== 'development') return true;
  if (!config.DEV_TEST_CHANNEL_ID || !context.guildId) return false;
  return (
    context.channelId === config.DEV_TEST_CHANNEL_ID ||
    (context.channel?.isThread?.() === true &&
      context.channel.parentId === config.DEV_TEST_CHANNEL_ID)
  );
}

export function isAiChannel(context: ChannelContext): boolean {
  return env.NODE_ENV === 'development'
    ? isDevelopmentChannelAllowed(context)
    : context.channelId === GuildConfig.DEVANEIOS_CHANNEL_ID;
}
