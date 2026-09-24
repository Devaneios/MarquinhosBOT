import { db as defaultDb, type Db } from '@marquinhos/database/client';
import {
  aiAgentUsage,
  aiChatConfig,
  aiResearchUsage,
} from '@marquinhos/database/schema';
import { eq, sql } from 'drizzle-orm';

export interface DailyQuota {
  usageTable: 'ai_agent_usage' | 'ai_research_usage';
  configKey: 'agent_daily_limit' | 'research_daily_limit';
  defaultLimit: number;
}

export const AGENT_DAILY_QUOTA: DailyQuota = {
  usageTable: 'ai_agent_usage',
  configKey: 'agent_daily_limit',
  defaultLimit: 50,
};

export const RESEARCH_DAILY_QUOTA: DailyQuota = {
  usageTable: 'ai_research_usage',
  configKey: 'research_daily_limit',
  defaultLimit: 50,
};

const USAGE_TABLES = {
  ai_agent_usage: aiAgentUsage,
  ai_research_usage: aiResearchUsage,
} as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export class DailyQuotaService {
  constructor(
    private quota: DailyQuota,
    private db: Db = defaultDb,
  ) {}

  async seedDefaults(): Promise<void> {
    await this.db
      .insert(aiChatConfig)
      .values({ key: this.quota.configKey, value: this.quota.defaultLimit })
      .onConflictDoNothing();
  }

  async checkAndIncrement(
    userId: string,
    guildId: string,
    date: string = today(),
  ): Promise<boolean> {
    const usage = USAGE_TABLES[this.quota.usageTable];
    const [row] = await this.db
      .insert(usage)
      .values({
        user_id: userId,
        guild_id: guildId,
        usage_date: date,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [usage.user_id, usage.guild_id, usage.usage_date],
        set: { count: sql`${usage.count} + 1` },
      })
      .returning({ count: usage.count });

    return !!row && row.count <= (await this.limit());
  }

  private async limit(): Promise<number> {
    const [row] = await this.db
      .select({ value: aiChatConfig.value })
      .from(aiChatConfig)
      .where(eq(aiChatConfig.key, this.quota.configKey));
    return row ? row.value : this.quota.defaultLimit;
  }
}
