import { Database } from 'bun:sqlite';
import { db as defaultDb } from 'database/sqlite';

interface AiChatConfigRow {
  key: string;
  value: number;
}

const DEFAULT_USER_DAILY_LIMIT = 100;
const DEFAULT_GLOBAL_DAILY_LIMIT = 2000;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

class RateLimitExceededSignal extends Error {}

export class RateLimitService {
  constructor(private db: Database = defaultDb) {}

  seedDefaults(): void {
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO ai_chat_config (key, value) VALUES ($key, $value)',
    );
    insert.run({ $key: 'user_daily_limit', $value: DEFAULT_USER_DAILY_LIMIT });
    insert.run({
      $key: 'global_daily_limit',
      $value: DEFAULT_GLOBAL_DAILY_LIMIT,
    });
  }

  checkAndIncrement(
    userId: string,
    guildId: string,
    date: string = today(),
  ): boolean {
    const userLimit = this.getConfigValue(
      'user_daily_limit',
      DEFAULT_USER_DAILY_LIMIT,
    );
    const globalLimit = this.getConfigValue(
      'global_daily_limit',
      DEFAULT_GLOBAL_DAILY_LIMIT,
    );

    const attempt = this.db.transaction(() => {
      const userRow = this.db
        .query<
          { count: number },
          { $userId: string; $guildId: string; $date: string }
        >(
          `INSERT INTO ai_chat_usage (user_id, guild_id, usage_date, count)
           VALUES ($userId, $guildId, $date, 1)
           ON CONFLICT(user_id, guild_id, usage_date) DO UPDATE SET
             count = count + 1
           RETURNING count`,
        )
        .get({ $userId: userId, $guildId: guildId, $date: date });

      if (!userRow || userRow.count > userLimit)
        throw new RateLimitExceededSignal();

      const globalRow = this.db
        .query<{ count: number }, { $guildId: string; $date: string }>(
          `INSERT INTO ai_chat_global_usage (guild_id, usage_date, count)
           VALUES ($guildId, $date, 1)
           ON CONFLICT(guild_id, usage_date) DO UPDATE SET
             count = count + 1
           RETURNING count`,
        )
        .get({ $guildId: guildId, $date: date });

      if (!globalRow || globalRow.count > globalLimit)
        throw new RateLimitExceededSignal();

      return true;
    });

    try {
      return attempt();
    } catch (err) {
      if (err instanceof RateLimitExceededSignal) return false;
      throw err;
    }
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
