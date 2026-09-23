import { db as defaultDb } from '@marquinhos/database/sqlite';
import { Database } from 'bun:sqlite';

interface AiChatConfigRow {
  key: string;
  value: number;
}

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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export class DailyQuotaService {
  constructor(
    private quota: DailyQuota,
    private db: Database = defaultDb,
  ) {}

  seedDefaults(): void {
    this.db
      .prepare(
        'INSERT OR IGNORE INTO ai_chat_config (key, value) VALUES ($key, $value)',
      )
      .run({ $key: this.quota.configKey, $value: this.quota.defaultLimit });
  }

  checkAndIncrement(
    userId: string,
    guildId: string,
    date: string = today(),
  ): boolean {
    const row = this.db
      .query<
        { count: number },
        { $userId: string; $guildId: string; $date: string }
      >(
        `INSERT INTO ${this.quota.usageTable} (user_id, guild_id, usage_date, count)
         VALUES ($userId, $guildId, $date, 1)
         ON CONFLICT(user_id, guild_id, usage_date) DO UPDATE SET
           count = count + 1
         RETURNING count`,
      )
      .get({ $userId: userId, $guildId: guildId, $date: date });

    return !!row && row.count <= this.limit();
  }

  private limit(): number {
    const row = this.db
      .query<AiChatConfigRow, { $key: string }>(
        'SELECT * FROM ai_chat_config WHERE key = $key',
      )
      .get({ $key: this.quota.configKey });
    return row ? row.value : this.quota.defaultLimit;
  }
}
