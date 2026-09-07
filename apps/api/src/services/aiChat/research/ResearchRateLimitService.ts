import { Database } from 'bun:sqlite';
import { db as defaultDb } from 'database/sqlite';

/**
 * Much lower than the chat and agent limits on purpose: one deep research job
 * spends dozens of LLM calls and up to two dozen page fetches.
 */
const DEFAULT_RESEARCH_DAILY_LIMIT = 50;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
export class ResearchRateLimitService {
  constructor(private db: Database = defaultDb) {}

  seedDefaults(): void {
    this.db
      .prepare(
        'INSERT OR IGNORE INTO ai_chat_config (key, value) VALUES ($key, $value)',
      )
      .run({
        $key: 'research_daily_limit',
        $value: DEFAULT_RESEARCH_DAILY_LIMIT,
      });
  }

  checkAndIncrement(
    userId: string,
    guildId: string,
    date: string = today(),
  ): boolean {
    const limit = DEFAULT_RESEARCH_DAILY_LIMIT;

    const row = this.db
      .query<
        { count: number },
        { $userId: string; $guildId: string; $date: string }
      >(
        `INSERT INTO ai_research_usage (user_id, guild_id, usage_date, count)
         VALUES ($userId, $guildId, $date, 1)
         ON CONFLICT(user_id, guild_id, usage_date) DO UPDATE SET
           count = count + 1
         RETURNING count`,
      )
      .get({ $userId: userId, $guildId: guildId, $date: date });

    return !!row && row.count <= limit;
  }
}
