import { wordleUserConfig } from '@marquinhos/database/schema';
import { describe, expect, it } from 'bun:test';
import { count } from 'drizzle-orm';
import { WordleUserConfigService } from 'services/wordleUserConfig';
import { useTestDb } from './helpers/testDb';

const testDb = useTestDb();

function createDatabase() {
  return testDb.current.db;
}

describe('WordleUserConfigService', () => {
  it('returns disabled defaults without creating a row', async () => {
    const db = createDatabase();
    const service = new WordleUserConfigService(db);

    expect(await service.get('user-1')).toEqual({
      invertActionKeys: false,
      enableSounds: false,
      enableSpaceKey: false,
      enableArrowKeys: false,
    });
    expect(await db.select({ count: count() }).from(wordleUserConfig)).toEqual([
      { count: 0 },
    ]);
  });

  it('creates and replaces the complete configuration', async () => {
    const db = createDatabase();
    const service = new WordleUserConfigService(db);

    expect(
      await service.update('user-1', {
        invertActionKeys: true,
        enableSounds: false,
        enableSpaceKey: true,
        enableArrowKeys: true,
      }),
    ).toEqual({
      invertActionKeys: true,
      enableSounds: false,
      enableSpaceKey: true,
      enableArrowKeys: true,
    });

    expect(
      await service.update('user-1', {
        invertActionKeys: false,
        enableSounds: true,
        enableSpaceKey: true,
        enableArrowKeys: false,
      }),
    ).toEqual({
      invertActionKeys: false,
      enableSounds: true,
      enableSpaceKey: true,
      enableArrowKeys: false,
    });
    expect(await service.get('user-1')).toEqual({
      invertActionKeys: false,
      enableSounds: true,
      enableSpaceKey: true,
      enableArrowKeys: false,
    });
    expect(
      await db
        .select({
          user_id: wordleUserConfig.user_id,
          invert_action_keys: wordleUserConfig.invert_action_keys,
          enable_sounds: wordleUserConfig.enable_sounds,
          enable_space_key: wordleUserConfig.enable_space_key,
          enable_arrow_keys: wordleUserConfig.enable_arrow_keys,
        })
        .from(wordleUserConfig),
    ).toEqual([
      {
        user_id: 'user-1',
        invert_action_keys: false,
        enable_sounds: true,
        enable_space_key: true,
        enable_arrow_keys: false,
      },
    ]);
  });
});
