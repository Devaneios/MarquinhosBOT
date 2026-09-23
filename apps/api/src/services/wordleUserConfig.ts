import type { WordleUserConfig } from '@marquinhos/contracts/wordle';
import type { Database } from 'bun:sqlite';

interface WordleUserConfigRow {
  invert_action_keys: number;
  enable_sounds: number;
  enable_space_key: number;
  enable_arrow_keys: number;
}

const DEFAULT_WORDLE_USER_CONFIG: WordleUserConfig = {
  invertActionKeys: false,
  enableSounds: false,
  enableSpaceKey: false,
  enableArrowKeys: false,
};

export class WordleUserConfigService {
  constructor(private readonly db: Database) {}

  get(userId: string): WordleUserConfig {
    const row = this.db
      .query<WordleUserConfigRow, [string]>(
        `SELECT invert_action_keys, enable_sounds,
                enable_space_key, enable_arrow_keys
         FROM wordle_user_config
         WHERE user_id = ?`,
      )
      .get(userId);

    if (!row) return { ...DEFAULT_WORDLE_USER_CONFIG };

    const baseConfig = {
      invertActionKeys: row.invert_action_keys === 1,
      enableSounds: row.enable_sounds === 1,
    };
    return row.enable_space_key === 1
      ? {
          ...baseConfig,
          enableSpaceKey: true,
          enableArrowKeys: row.enable_arrow_keys === 1,
        }
      : { ...baseConfig, enableSpaceKey: false, enableArrowKeys: false };
  }

  update(userId: string, config: WordleUserConfig): WordleUserConfig {
    this.db
      .query<unknown, [string, number, number, number, number, number]>(
        `INSERT INTO wordle_user_config
           (user_id, invert_action_keys, enable_sounds, enable_space_key,
            enable_arrow_keys, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           invert_action_keys = excluded.invert_action_keys,
           enable_sounds = excluded.enable_sounds,
           enable_space_key = excluded.enable_space_key,
           enable_arrow_keys = excluded.enable_arrow_keys,
           updated_at = excluded.updated_at`,
      )
      .run(
        userId,
        Number(config.invertActionKeys),
        Number(config.enableSounds),
        Number(config.enableSpaceKey),
        Number(config.enableArrowKeys),
        Math.floor(Date.now() / 1000),
      );

    return config;
  }
}
