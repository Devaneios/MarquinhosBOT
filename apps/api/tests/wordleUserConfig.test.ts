import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { WordleUserConfigService } from 'services/wordleUserConfig';

function createDatabase(): Database {
  const db = new Database(':memory:');
  db.run(`
    CREATE TABLE wordle_user_config (
      user_id TEXT NOT NULL PRIMARY KEY,
      invert_action_keys INTEGER NOT NULL DEFAULT 0 CHECK (invert_action_keys IN (0, 1)),
      enable_sounds INTEGER NOT NULL DEFAULT 0 CHECK (enable_sounds IN (0, 1)),
      enable_space_key INTEGER NOT NULL DEFAULT 0 CHECK (enable_space_key IN (0, 1)),
      enable_arrow_keys INTEGER NOT NULL DEFAULT 0 CHECK (enable_arrow_keys IN (0, 1)),
      updated_at INTEGER NOT NULL DEFAULT (cast(strftime('%s','now') as int))
    )
  `);
  return db;
}

describe('WordleUserConfigService', () => {
  it('returns disabled defaults without creating a row', () => {
    const db = createDatabase();
    const service = new WordleUserConfigService(db);

    expect(service.get('user-1')).toEqual({
      invertActionKeys: false,
      enableSounds: false,
      enableSpaceKey: false,
      enableArrowKeys: false,
    });
    expect(
      db.query('SELECT COUNT(*) AS count FROM wordle_user_config').get(),
    ).toEqual({ count: 0 });
  });

  it('creates and replaces the complete configuration', () => {
    const db = createDatabase();
    const service = new WordleUserConfigService(db);

    expect(
      service.update('user-1', {
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
      service.update('user-1', {
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
    expect(service.get('user-1')).toEqual({
      invertActionKeys: false,
      enableSounds: true,
      enableSpaceKey: true,
      enableArrowKeys: false,
    });
    expect(
      db
        .query(
          `SELECT user_id, invert_action_keys, enable_sounds,
                  enable_space_key, enable_arrow_keys
           FROM wordle_user_config`,
        )
        .all(),
    ).toEqual([
      {
        user_id: 'user-1',
        invert_action_keys: 0,
        enable_sounds: 1,
        enable_space_key: 1,
        enable_arrow_keys: 0,
      },
    ]);
  });
});
