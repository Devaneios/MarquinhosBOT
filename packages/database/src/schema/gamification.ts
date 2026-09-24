import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core';

export const xpConfig = pgTable('xp_config', {
  event_type: text('event_type').primaryKey(),
  xp_amount: integer('xp_amount').notNull(),
  cooldown_ms: bigint('cooldown_ms', { mode: 'number' }),
});

export const userLevels = pgTable(
  'user_levels',
  {
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    level: integer('level').notNull().default(1),
    xp: integer('xp').notNull().default(0),
    total_xp: integer('total_xp').notNull().default(0),
    last_xp_gain: bigint('last_xp_gain', { mode: 'number' }),
    updated_at: bigint('updated_at', { mode: 'number' }),
  },
  (t) => [
    primaryKey({ columns: [t.user_id, t.guild_id] }),
    index('idx_user_levels_leaderboard').on(
      t.guild_id,
      t.level.desc(),
      t.total_xp.desc(),
    ),
  ],
);

export const achievements = pgTable(
  'achievements',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    rarity: text('rarity').notNull(),
    icon: text('icon').notNull(),
    condition: text('condition').notNull(),
    reward_xp: integer('reward_xp').notNull().default(0),
  },
  (t) => [
    check(
      'achievements_rarity_check',
      sql`${t.rarity} IN ('common','rare','epic','legendary')`,
    ),
  ],
);

export const userAchievements = pgTable(
  'user_achievements',
  {
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    achievement_id: text('achievement_id')
      .notNull()
      .references(() => achievements.id),
    unlocked_at: bigint('unlocked_at', { mode: 'number' }).notNull(),
    updated_at: bigint('updated_at', { mode: 'number' }),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.guild_id, t.achievement_id] })],
);

export const userStats = pgTable(
  'user_stats',
  {
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    total_commands: integer('total_commands').notNull().default(0),
    total_scrobbles: integer('total_scrobbles').notNull().default(0),
    total_voice_joins: integer('total_voice_joins').notNull().default(0),
    total_games: integer('total_games').notNull().default(0),
    games_won: integer('games_won').notNull().default(0),
    updated_at: bigint('updated_at', { mode: 'number' }),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.guild_id] })],
);

export const xpCooldowns = pgTable(
  'xp_cooldowns',
  {
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    event_type: text('event_type').notNull(),
    last_gain: bigint('last_gain', { mode: 'number' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.guild_id, t.event_type] })],
);

export const gameResults = pgTable(
  'game_results',
  {
    id: text('id').primaryKey(),
    guild_id: text('guild_id').notNull(),
    game_type: text('game_type').notNull(),
    played_at: bigint('played_at', { mode: 'number' }).notNull(),
    duration_ms: bigint('duration_ms', { mode: 'number' }),
  },
  (t) => [index('idx_game_results_guild_type').on(t.guild_id, t.game_type)],
);

export const userGameResults = pgTable(
  'user_game_results',
  {
    game_result_id: text('game_result_id')
      .notNull()
      .references(() => gameResults.id),
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    position: integer('position').notNull(),
    xp_awarded: integer('xp_awarded').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.game_result_id, t.user_id] }),
    index('idx_user_game_results_user').on(t.user_id, t.guild_id),
  ],
);

export const evolutiveAchievements = pgTable(
  'evolutive_achievements',
  {
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    base_id: text('base_id').notNull(),
    current_tier: integer('current_tier').notNull().default(1),
    unlocked_at: bigint('unlocked_at', { mode: 'number' }).notNull(),
    last_evolved: bigint('last_evolved', { mode: 'number' }),
    evolution_log: text('evolution_log').notNull().default('[]'),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.guild_id, t.base_id] })],
);
