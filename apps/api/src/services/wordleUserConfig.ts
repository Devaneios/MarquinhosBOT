import type { Database } from 'bun:sqlite';

export interface WordleUserConfig {
  invertActionKeys: boolean;
  enableSounds: boolean;
}

interface WordleUserConfigRow {
  invert_action_keys: number;
  enable_sounds: number;
}

const DEFAULT_WORDLE_USER_CONFIG: WordleUserConfig = {
  invertActionKeys: false,
  enableSounds: false,
};

export class WordleUserConfigService {
  constructor(private readonly db: Database) {}

  get(userId: string): WordleUserConfig {
    const row = this.db
      .query<WordleUserConfigRow, [string]>(
        `SELECT invert_action_keys, enable_sounds
         FROM wordle_user_config
         WHERE user_id = ?`,
      )
      .get(userId);

    if (!row) return { ...DEFAULT_WORDLE_USER_CONFIG };

    return {
      invertActionKeys: row.invert_action_keys === 1,
      enableSounds: row.enable_sounds === 1,
    };
  }

  update(userId: string, config: WordleUserConfig): WordleUserConfig {
    this.db
      .query<unknown, [string, number, number, number]>(
        `INSERT INTO wordle_user_config
           (user_id, invert_action_keys, enable_sounds, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           invert_action_keys = excluded.invert_action_keys,
           enable_sounds = excluded.enable_sounds,
           updated_at = excluded.updated_at`,
      )
      .run(
        userId,
        Number(config.invertActionKeys),
        Number(config.enableSounds),
        Math.floor(Date.now() / 1000),
      );

    return config;
  }
}
