import { db as defaultDb, type Db } from '@marquinhos/database/client';
import {
  aiChatConfig,
  aiChatGlobalUsage,
  aiChatUsage,
} from '@marquinhos/database/schema';
import { eq, sql } from 'drizzle-orm';

const DEFAULT_USER_DAILY_LIMIT = 100;
const DEFAULT_GLOBAL_DAILY_LIMIT = 2000;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

class RateLimitExceededSignal extends Error {}

export class RateLimitService {
  constructor(private db: Db = defaultDb) {}

  async seedDefaults(): Promise<void> {
    await this.db
      .insert(aiChatConfig)
      .values([
        { key: 'user_daily_limit', value: DEFAULT_USER_DAILY_LIMIT },
        { key: 'global_daily_limit', value: DEFAULT_GLOBAL_DAILY_LIMIT },
      ])
      .onConflictDoNothing();
  }

  async checkAndIncrement(
    userId: string,
    guildId: string,
    date: string = today(),
  ): Promise<boolean> {
    const userLimit = await this.getConfigValue(
      'user_daily_limit',
      DEFAULT_USER_DAILY_LIMIT,
    );
    const globalLimit = await this.getConfigValue(
      'global_daily_limit',
      DEFAULT_GLOBAL_DAILY_LIMIT,
    );

    try {
      // Both counters move together or not at all: throwing the signal rolls
      // back the increment that pushed a counter over its limit.
      return await this.db.transaction(async (tx) => {
        const [userRow] = await tx
          .insert(aiChatUsage)
          .values({
            user_id: userId,
            guild_id: guildId,
            usage_date: date,
            count: 1,
          })
          .onConflictDoUpdate({
            target: [
              aiChatUsage.user_id,
              aiChatUsage.guild_id,
              aiChatUsage.usage_date,
            ],
            set: { count: sql`${aiChatUsage.count} + 1` },
          })
          .returning({ count: aiChatUsage.count });

        if (!userRow || userRow.count > userLimit)
          throw new RateLimitExceededSignal();

        const [globalRow] = await tx
          .insert(aiChatGlobalUsage)
          .values({ guild_id: guildId, usage_date: date, count: 1 })
          .onConflictDoUpdate({
            target: [aiChatGlobalUsage.guild_id, aiChatGlobalUsage.usage_date],
            set: { count: sql`${aiChatGlobalUsage.count} + 1` },
          })
          .returning({ count: aiChatGlobalUsage.count });

        if (!globalRow || globalRow.count > globalLimit)
          throw new RateLimitExceededSignal();

        return true;
      });
    } catch (err) {
      if (err instanceof RateLimitExceededSignal) return false;
      throw err;
    }
  }

  private async getConfigValue(key: string, fallback: number): Promise<number> {
    const [row] = await this.db
      .select({ value: aiChatConfig.value })
      .from(aiChatConfig)
      .where(eq(aiChatConfig.key, key));
    return row ? row.value : fallback;
  }
}
