import { Database } from 'bun:sqlite';
import { db as defaultDb } from 'database/sqlite';

interface AiChatConfigRow {
  key: string;
  value: number;
}

const DEFAULT_AGENT_DAILY_LIMIT = 50;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export class AgentRateLimitService {
  constructor(private db: Database = defaultDb) {}

  seedDefaults(): void {
    this.db
      .prepare(
        'INSERT OR IGNORE INTO ai_chat_config (key, value) VALUES ($key, $value)',
      )
      .run({ $key: 'agent_daily_limit', $value: DEFAULT_AGENT_DAILY_LIMIT });
  }

  checkAndIncrement(
    userId: string,
    guildId: string,
    date: string = today(),
  ): boolean {
    const limit = this.getConfigValue(
      'agent_daily_limit',
      DEFAULT_AGENT_DAILY_LIMIT,
    );

    const row = this.db
      .query<
        { count: number },
        { $userId: string; $guildId: string; $date: string }
      >(
        `INSERT INTO ai_agent_usage (user_id, guild_id, usage_date, count)
         VALUES ($userId, $guildId, $date, 1)
         ON CONFLICT(user_id, guild_id, usage_date) DO UPDATE SET
           count = count + 1
         RETURNING count`,
      )
      .get({ $userId: userId, $guildId: guildId, $date: date });

    return !!row && row.count <= limit;
  }

  private getConfigValue(key: string, fallback: number): number {
    const row = this.db
      .query<AiChatConfigRow, { $key: string }>(
        'SELECT * FROM ai_chat_config WHERE key = $key',
      )
      .get({ $key: key });
    return row ? row.value : fallback;
  }
}
