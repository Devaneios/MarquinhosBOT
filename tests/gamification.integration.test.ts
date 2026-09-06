import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, it } from 'bun:test';

// GamificationService is hardwired to the module-level db singleton (no DI),
// so we replicate the cooldown SQL logic directly against an in-memory DB.
// This tests the exact same INSERT ... ON CONFLICT query used in GamificationService.addXP.

function setupDb(): Database {
  const db = new Database(':memory:');

  db.run(`
    CREATE TABLE xp_config (
      event_type  TEXT    NOT NULL PRIMARY KEY,
      xp_amount   INTEGER NOT NULL,
      cooldown_ms INTEGER
    )
  `);

  db.run(`
    CREATE TABLE user_levels (
      user_id      TEXT    NOT NULL,
      guild_id     TEXT    NOT NULL,
      level        INTEGER NOT NULL DEFAULT 1,
      xp           INTEGER NOT NULL DEFAULT 0,
      total_xp     INTEGER NOT NULL DEFAULT 0,
      last_xp_gain INTEGER,
      PRIMARY KEY (user_id, guild_id)
    )
  `);

  db.run(`
    CREATE TABLE user_stats (
      user_id           TEXT    NOT NULL,
      guild_id          TEXT    NOT NULL,
      total_commands    INTEGER NOT NULL DEFAULT 0,
      total_scrobbles   INTEGER NOT NULL DEFAULT 0,
      total_voice_joins INTEGER NOT NULL DEFAULT 0,
      total_games       INTEGER NOT NULL DEFAULT 0,
      games_won         INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, guild_id)
    )
  `);

  db.run(`
    CREATE TABLE xp_cooldowns (
      user_id    TEXT    NOT NULL,
      guild_id   TEXT    NOT NULL,
      event_type TEXT    NOT NULL,
      last_gain  INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id, event_type)
    )
  `);

  db.run(
    "INSERT INTO xp_config (event_type, xp_amount, cooldown_ms) VALUES ('command', 5, 60000)",
  );

  return db;
}

function ensureUser(db: Database, userId: string, guildId: string): void {
  db.query(
    'INSERT OR IGNORE INTO user_levels (user_id, guild_id) VALUES ($userId, $guildId)',
  ).run({ $userId: userId, $guildId: guildId });
  db.query(
    'INSERT OR IGNORE INTO user_stats (user_id, guild_id) VALUES ($userId, $guildId)',
  ).run({ $userId: userId, $guildId: guildId });
}

interface XpConfig {
  event_type: string;
  xp_amount: number;
  cooldown_ms: number | null;
}

function addXP(
  db: Database,
  userId: string,
  guildId: string,
  eventType: string,
  now?: number,
): { xpGained: number; onCooldown: boolean } {
  ensureUser(db, userId, guildId);

  const config = db
    .query<XpConfig, { $eventType: string }>(
      'SELECT * FROM xp_config WHERE event_type = $eventType',
    )
    .get({ $eventType: eventType });

  if (!config) throw new Error(`Unknown event type: ${eventType}`);

  const ts = now ?? Date.now();

  if (config.cooldown_ms !== null) {
    const result = db
      .query<
        { granted: number },
        {
          $userId: string;
          $guildId: string;
          $eventType: string;
          $now: number;
          $cooldownMs: number;
        }
      >(
        `INSERT INTO xp_cooldowns (user_id, guild_id, event_type, last_gain)
         VALUES ($userId, $guildId, $eventType, $now)
         ON CONFLICT(user_id, guild_id, event_type) DO UPDATE SET
           last_gain = CASE
             WHEN ($now - xp_cooldowns.last_gain) >= $cooldownMs THEN $now
             ELSE xp_cooldowns.last_gain
           END
         RETURNING (last_gain = $now) AS granted`,
      )
      .get({
        $userId: userId,
        $guildId: guildId,
        $eventType: eventType,
        $now: ts,
        $cooldownMs: config.cooldown_ms,
      });

    if (result && result.granted !== 1) {
      return { xpGained: 0, onCooldown: true };
    }
  }

  db.query(
    'UPDATE user_levels SET xp = xp + $amount, total_xp = total_xp + $amount WHERE user_id = $userId AND guild_id = $guildId',
  ).run({ $amount: config.xp_amount, $userId: userId, $guildId: guildId });

  return { xpGained: config.xp_amount, onCooldown: false };
}

describe('XP cooldown logic', () => {
  let db: Database;

  beforeEach(() => {
    db = setupDb();
  });

  it('grants XP on the first addXP call', () => {
    const result = addXP(db, 'user1', 'guild1', 'command');
    expect(result.xpGained).toBeGreaterThan(0);
    expect(result.onCooldown).toBe(false);
  });

  it('returns xpGained === 0 when same call is made within cooldown window', () => {
    const now = Date.now();
    addXP(db, 'user1', 'guild1', 'command', now);
    const second = addXP(db, 'user1', 'guild1', 'command', now + 1000);
    expect(second.xpGained).toBe(0);
    expect(second.onCooldown).toBe(true);
  });

  it('grants XP again after cooldown expires', () => {
    const now = Date.now();
    addXP(db, 'user1', 'guild1', 'command', now);
    const after = addXP(db, 'user1', 'guild1', 'command', now + 61_000);
    expect(after.xpGained).toBeGreaterThan(0);
    expect(after.onCooldown).toBe(false);
  });

  it('does not enforce cooldown across different users', () => {
    const now = Date.now();
    addXP(db, 'user1', 'guild1', 'command', now);
    const result = addXP(db, 'user2', 'guild1', 'command', now + 1000);
    expect(result.xpGained).toBeGreaterThan(0);
    expect(result.onCooldown).toBe(false);
  });
});
