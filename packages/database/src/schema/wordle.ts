import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  integer,
  pgTable,
  primaryKey,
  text,
  unique,
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

export const wordleDaily = pgTable('wordle_daily', {
  guild_id: text('guild_id').primaryKey(),
  word: text('word').notNull(),
  word_date: text('word_date').notNull(),
  players_count: integer('players_count').notNull().default(0),
  winners_count: integer('winners_count').notNull().default(0),
  total_attempts: integer('total_attempts').notNull().default(0),
  created_at: bigint('created_at', { mode: 'number' }).notNull(),
});

export const wordleSessions = pgTable(
  'wordle_sessions',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    word_date: text('word_date').notNull(),
    guesses: text('guesses').notNull().default('[]'),
    solved: boolean('solved').notNull().default(false),
    attempts: integer('attempts').notNull().default(0),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
    word_length: integer('word_length').notNull().default(0),
    announced_at: bigint('announced_at', { mode: 'number' }),
  },
  (t) => [unique().on(t.user_id, t.guild_id, t.word_date)],
);

export const wordlistReview = pgTable('wordlist_review', {
  word: text('word').primaryKey(),
  is_banned: boolean('is_banned'),
  // Stands in for SQLite's rowid: the review walks words in insertion order.
  seq: bigserial('seq', { mode: 'number' }).notNull(),
});

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
