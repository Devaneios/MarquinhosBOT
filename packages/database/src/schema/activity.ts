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

export const mazeSessions = pgTable(
  'maze_sessions',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    game_mode: text('game_mode').$type<'open' | 'foggy'>().notNull(),
    maze_width: integer('maze_width').notNull(),
    maze_height: integer('maze_height').notNull(),
    maze_grid: text('maze_grid').notNull(),
    player_x: integer('player_x').notNull(),
    player_y: integer('player_y').notNull(),
    moves_count: integer('moves_count').notNull().default(0),
    status: text('status')
      .$type<'active' | 'completed' | 'abandoned'>()
      .notNull()
      .default('active'),
    started_at: bigint('started_at', { mode: 'number' }).notNull(),
    completed_at: bigint('completed_at', { mode: 'number' }),
  },
  (t) => [
    check(
      'maze_sessions_game_mode_check',
      sql`${t.game_mode} IN ('open','foggy')`,
    ),
    check(
      'maze_sessions_status_check',
      sql`${t.status} IN ('active','completed','abandoned')`,
    ),
    index('idx_maze_sessions_user').on(t.user_id, t.guild_id, t.status),
  ],
);

export const activityDeepLinks = pgTable(
  'activity_deep_links',
  {
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    game: text('game').notNull(),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.guild_id] })],
);
