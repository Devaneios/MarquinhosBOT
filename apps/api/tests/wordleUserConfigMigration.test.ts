import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const migrationPath = path.join(
  import.meta.dir,
  '../../../packages/database/src/migrations',
  '005_create_wordle_user_config.sql',
);

describe('005_create_wordle_user_config.sql', () => {
  it('creates a lazy per-user config table with disabled defaults', () => {
    const db = new Database(':memory:');

    db.run(fs.readFileSync(migrationPath, 'utf8'));

    db.run('INSERT INTO wordle_user_config (user_id) VALUES (?)', ['user-1']);
    expect(db.query('SELECT * FROM wordle_user_config').all()).toEqual([
      {
        user_id: 'user-1',
        invert_action_keys: 0,
        enable_sounds: 0,
        updated_at: expect.any(Number),
      },
    ]);
    expect(() =>
      db.run(
        'INSERT INTO wordle_user_config (user_id, enable_sounds) VALUES (?, ?)',
        ['user-2', 2],
      ),
    ).toThrow();
  });
});
