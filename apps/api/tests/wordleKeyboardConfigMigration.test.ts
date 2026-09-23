import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

function readMigration(name: string): string {
  return fs.readFileSync(
    path.join(
      import.meta.dir,
      '../../../packages/database/src/migrations',
      name,
    ),
    'utf8',
  );
}

describe('006_add_wordle_keyboard_config.sql', () => {
  it('adds disabled space and arrow settings to existing config rows', () => {
    const db = new Database(':memory:');
    db.run(readMigration('005_create_wordle_user_config.sql'));
    db.run('INSERT INTO wordle_user_config (user_id) VALUES (?)', ['user-1']);

    db.run(readMigration('006_add_wordle_keyboard_config.sql'));

    expect(db.query('SELECT * FROM wordle_user_config').all()).toEqual([
      {
        user_id: 'user-1',
        invert_action_keys: 0,
        enable_sounds: 0,
        updated_at: expect.any(Number),
        enable_space_key: 0,
        enable_arrow_keys: 0,
      },
    ]);
    expect(() =>
      db.run(
        'UPDATE wordle_user_config SET enable_arrow_keys = ? WHERE user_id = ?',
        [2, 'user-1'],
      ),
    ).toThrow();
    expect(() =>
      db.run(
        'UPDATE wordle_user_config SET enable_arrow_keys = 1 WHERE user_id = ?',
        ['user-1'],
      ),
    ).toThrow();
  });
});
