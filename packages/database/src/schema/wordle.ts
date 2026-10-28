import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const wordleUsedWords = pgTable('wordle_used_words', {
  word: text('word').primaryKey(),
  used_at: bigint('used_at', { mode: 'number' }).notNull(),
});

export const wordleConfig = pgTable('wordle_config', {
  guild_id: text('guild_id').primaryKey(),
  channel_id: text('channel_id').notNull(),
  updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
});

// legacy: superseded by wordle_days. Compat triggers keep both in sync so the
// previous release keeps working; dropped in the contract release.
export const wordleDaily = pgTable('wordle_daily', {
  guild_id: text('guild_id').primaryKey(),
  word: text('word').notNull(),
  word_date: text('word_date').notNull(),
  players_count: integer('players_count').notNull().default(0),
  winners_count: integer('winners_count').notNull().default(0),
  total_attempts: integer('total_attempts').notNull().default(0),
  created_at: bigint('created_at', { mode: 'number' }).notNull(),
});

export const wordleDays = pgTable(
  'wordle_days',
  {
    guild_id: text('guild_id').notNull(),
    word_date: text('word_date').notNull(),
    word: text('word'),
    word_length: integer('word_length'),
    is_legacy: boolean('is_legacy').notNull().default(false),
    players_count: integer('players_count').notNull().default(0),
    winners_count: integer('winners_count').notNull().default(0),
    total_attempts: integer('total_attempts').notNull().default(0),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.guild_id, t.word_date] }),
    check(
      'wordle_days_word_length_check',
      sql`${t.word_length} IS NULL OR ${t.word_length} > 0`,
    ),
    check(
      'wordle_days_word_matches_length_check',
      sql`${t.word} IS NULL OR (${t.word_length} IS NOT NULL AND char_length(${t.word}) = ${t.word_length})`,
    ),
    check(
      'wordle_days_current_word_required_check',
      sql`${t.is_legacy} OR (${t.word} IS NOT NULL AND ${t.word_length} IS NOT NULL)`,
    ),
  ],
);

export const wordleSessions = pgTable(
  'wordle_sessions',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    word_date: text('word_date').notNull(),
    guesses: text('guesses').notNull().default('[]'),
    solved: boolean('solved').notNull().default(false),
    solved_at: bigint('solved_at', { mode: 'number' }),
    first_solver: boolean('first_solver'),
    attempts: integer('attempts').notNull().default(0),
    achievement_version: integer('achievement_version').notNull().default(1),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
    // legacy: the length lives on wordle_days (a trigger fills it). Dropped in
    // the contract release, together with the wordle_sessions -> wordle_days FK.
    word_length: integer('word_length').notNull().default(0),
    announced_at: bigint('announced_at', { mode: 'number' }),
  },
  (t) => [
    unique().on(t.user_id, t.guild_id, t.word_date),
    index('wordle_sessions_guild_solve_idx').on(
      t.guild_id,
      t.word_date,
      t.solved_at,
    ),
    uniqueIndex('wordle_sessions_first_solver_idx')
      .on(t.guild_id, t.word_date)
      .where(sql`${t.first_solver} = true`),
  ],
);

export const wordleAchievementVersions = pgTable(
  'wordle_achievement_versions',
  {
    version: integer('version').primaryKey(),
    active: boolean('active').notNull().default(false),
    activated_at: bigint('activated_at', { mode: 'number' }).notNull(),
    catalog_revision: integer('catalog_revision').notNull().default(0),
  },
  (table) => [
    uniqueIndex('wordle_achievement_versions_active_idx')
      .on(table.active)
      .where(sql`${table.active} = true`),
    check('wordle_achievement_versions_positive', sql`${table.version} > 0`),
  ],
);

export const wordlePatternDiscoveries = pgTable(
  'wordle_pattern_discoveries',
  {
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    version: integer('version').notNull(),
    pattern_id: text('pattern_id').notNull(),
    session_id: text('session_id').notNull(),
    discovered_at: bigint('discovered_at', { mode: 'number' }).notNull(),
    evidence: jsonb('evidence').$type<unknown>().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.user_id, table.guild_id, table.version, table.pattern_id],
    }),
  ],
);

export const wordlistReview = pgTable(
  'wordlist_review',
  {
    word: text('word').primaryKey(),
    is_banned: boolean('is_banned'),
    // Stands in for SQLite's rowid: the review walks words in insertion order.
    seq: bigserial('seq', { mode: 'number' }).notNull(),
  },
  (t) => [
    index('wordlist_review_pending_seq_idx')
      .on(t.seq)
      .where(sql`${t.is_banned} IS NULL`),
  ],
);

export const wordleStreaks = pgTable(
  'wordle_streaks',
  {
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    current_streak: integer('current_streak').notNull().default(0),
    max_streak: integer('max_streak').notNull().default(0),
    last_solved_date: text('last_solved_date'),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.guild_id] })],
);

export const wordleUserConfig = pgTable(
  'wordle_user_config',
  {
    user_id: text('user_id').primaryKey(),
    invert_action_keys: boolean('invert_action_keys').notNull().default(false),
    enable_sounds: boolean('enable_sounds').notNull().default(false),
    updated_at: bigint('updated_at', { mode: 'number' })
      .notNull()
      .default(sql`extract(epoch from now())::bigint`),
    enable_space_key: boolean('enable_space_key').notNull().default(false),
    enable_arrow_keys: boolean('enable_arrow_keys').notNull().default(false),
  },
  (t) => [
    check(
      'wordle_user_config_arrow_requires_space',
      sql`NOT (${t.enable_arrow_keys} AND NOT ${t.enable_space_key})`,
    ),
  ],
);
