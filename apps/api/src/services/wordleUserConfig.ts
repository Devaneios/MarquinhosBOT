import type { WordleUserConfig } from '@marquinhos/contracts/wordle';
import type { Db } from '@marquinhos/database/client';
import { wordleUserConfig } from '@marquinhos/database/schema';
import { eq } from 'drizzle-orm';

const DEFAULT_WORDLE_USER_CONFIG: WordleUserConfig = {
  invertActionKeys: false,
  enableSounds: false,
  enableSpaceKey: false,
  enableArrowKeys: false,
};

export class WordleUserConfigService {
  constructor(private readonly db: Db) {}

  async get(userId: string): Promise<WordleUserConfig> {
    const [row] = await this.db
      .select({
        invert_action_keys: wordleUserConfig.invert_action_keys,
        enable_sounds: wordleUserConfig.enable_sounds,
        enable_space_key: wordleUserConfig.enable_space_key,
        enable_arrow_keys: wordleUserConfig.enable_arrow_keys,
      })
      .from(wordleUserConfig)
      .where(eq(wordleUserConfig.user_id, userId));

    if (!row) return { ...DEFAULT_WORDLE_USER_CONFIG };

    const baseConfig = {
      invertActionKeys: row.invert_action_keys,
      enableSounds: row.enable_sounds,
    };
    return row.enable_space_key
      ? {
          ...baseConfig,
          enableSpaceKey: true,
          enableArrowKeys: row.enable_arrow_keys,
        }
      : { ...baseConfig, enableSpaceKey: false, enableArrowKeys: false };
  }

  async update(
    userId: string,
    config: WordleUserConfig,
  ): Promise<WordleUserConfig> {
    const values = {
      invert_action_keys: config.invertActionKeys,
      enable_sounds: config.enableSounds,
      enable_space_key: config.enableSpaceKey,
      enable_arrow_keys: config.enableArrowKeys,
      updated_at: Math.floor(Date.now() / 1000),
    };
    await this.db
      .insert(wordleUserConfig)
      .values({ user_id: userId, ...values })
      .onConflictDoUpdate({ target: wordleUserConfig.user_id, set: values });

    return config;
  }
}
