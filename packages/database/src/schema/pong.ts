import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  unique,
} from 'drizzle-orm/pg-core';

export const pongRatings = pgTable(
  'pong_ratings',
  {
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    pool: text('pool').notNull(),
    rating: doublePrecision('rating').notNull().default(1500),
    deviation: doublePrecision('deviation').notNull().default(350),
    volatility: doublePrecision('volatility').notNull().default(0.06),
    matches: integer('matches').notNull().default(0),
    wins: integer('wins').notNull().default(0),
    updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.user_id, t.guild_id, t.pool] }),
    check(
      'pong_ratings_pool_check',
      sql`${t.pool} IN ('classic-1v1', 'quad-elimination')`,
    ),
    index('idx_pong_ratings_leaderboard').on(
      t.guild_id,
      t.pool,
      t.rating.desc(),
    ),
  ],
);

export const pongRankedMatches = pgTable('pong_ranked_matches', {
  id: text('id').primaryKey(),
  session_id: text('session_id').notNull(),
  guild_id: text('guild_id').notNull(),
  pool: text('pool').notNull(),
  results_json: text('results_json').notNull(),
  played_at: bigint('played_at', { mode: 'number' }).notNull(),
});

export const pongTournaments = pgTable(
  'pong_tournaments',
  {
    id: text('id').primaryKey(),
    guild_id: text('guild_id').notNull(),
    name: text('name').notNull(),
    format: text('format').notNull(),
    pool: text('pool').notNull(),
    status: text('status').notNull(),
    config_json: text('config_json').notNull(),
    created_by: text('created_by').notNull(),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    check(
      'pong_tournaments_format_check',
      sql`${t.format} IN ('round-robin', 'double-elimination', 'swiss-playoff')`,
    ),
    check(
      'pong_tournaments_status_check',
      sql`${t.status} IN ('registration', 'active', 'complete')`,
    ),
  ],
);

export const pongTournamentEntries = pgTable(
  'pong_tournament_entries',
  {
    tournament_id: text('tournament_id')
      .notNull()
      .references(() => pongTournaments.id),
    user_id: text('user_id').notNull(),
    seed: integer('seed').notNull(),
    rating: doublePrecision('rating').notNull(),
    score: doublePrecision('score').notNull().default(0),
    eliminated: boolean('eliminated').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.tournament_id, t.user_id] })],
);

export const pongTournamentMatches = pgTable(
  'pong_tournament_matches',
  {
    id: text('id').primaryKey(),
    tournament_id: text('tournament_id')
      .notNull()
      .references(() => pongTournaments.id),
    bracket: text('bracket').notNull(),
    round: integer('round').notNull(),
    position: integer('position').notNull(),
    player_a: text('player_a'),
    player_b: text('player_b'),
    winner_id: text('winner_id'),
    status: text('status').notNull(),
    source_a: text('source_a'),
    source_b: text('source_b'),
  },
  (t) => [
    check(
      'pong_tournament_matches_status_check',
      sql`${t.status} IN ('pending', 'ready', 'complete')`,
    ),
    unique().on(t.tournament_id, t.bracket, t.round, t.position),
  ],
);
