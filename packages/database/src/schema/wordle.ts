import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { achievements } from './gamification';

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
    solved_from_draft: boolean('solved_from_draft').notNull().default(false),
    solved_at: bigint('solved_at', { mode: 'number' }),
    first_solver: boolean('first_solver'),
    attempts: integer('attempts').notNull().default(0),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
    // legacy: the length lives on wordle_days (a trigger fills it). Dropped in
    // the contract release, together with the wordle_sessions -> wordle_days FK.
    word_length: integer('word_length').notNull().default(0),
    announced_at: bigint('announced_at', { mode: 'number' }),
  },
  (t) => [
    unique().on(t.user_id, t.guild_id, t.word_date),
    check(
      'wordle_sessions_draft_win_check',
      sql`NOT ${t.solved_from_draft} OR (${t.solved} AND ${t.attempts} = 0)`,
    ),
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

export const wordleDrafts = pgTable(
  'wordle_drafts',
  {
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    word_date: text('word_date').notNull(),
    row_index: integer('row_index').notNull(),
    cells: jsonb('cells').$type<string[]>().notNull(),
    active_index: integer('active_index').notNull(),
    revision: integer('revision').notNull(),
    updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
    finalized_at: bigint('finalized_at', { mode: 'number' }),
    award_reconciled_at: bigint('award_reconciled_at', { mode: 'number' }),
  },
  (t) => [
    primaryKey({ columns: [t.user_id, t.guild_id, t.word_date] }),
    index('wordle_drafts_pending_finalization_idx')
      .on(t.word_date, t.guild_id)
      .where(sql`${t.finalized_at} IS NULL`),
    index('wordle_drafts_pending_award_idx')
      .on(t.word_date, t.guild_id)
      .where(
        sql`${t.finalized_at} IS NOT NULL AND ${t.award_reconciled_at} IS NULL`,
      ),
    check('wordle_drafts_row_index_check', sql`${t.row_index} >= 0`),
    check(
      'wordle_drafts_active_index_check',
      sql`${t.active_index} BETWEEN 0 AND 11`,
    ),
    check('wordle_drafts_revision_check', sql`${t.revision} > 0`),
    check(
      'wordle_drafts_cells_check',
      sql`jsonb_typeof(${t.cells}) = 'array' AND jsonb_array_length(${t.cells}) BETWEEN 5 AND 12`,
    ),
  ],
);

export const wordlePatternDiscoveries = pgTable(
  'wordle_pattern_discoveries',
  {
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    pattern_id: text('pattern_id').notNull(),
    session_id: text('session_id').notNull(),
    discovered_at: bigint('discovered_at', { mode: 'number' }).notNull(),
    evidence: jsonb('evidence').$type<unknown>().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.user_id, table.guild_id, table.pattern_id],
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

// Global Wordle state is introduced alongside the legacy guild-scoped tables.
// Writers move to these tables only after historical conflicts are resolved.
export const wordleGlobalDays = pgTable(
  'wordle_global_days',
  {
    word_date: text('word_date').primaryKey(),
    word: text('word').notNull(),
    word_length: integer('word_length').notNull(),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    check('wordle_global_days_word_length_check', sql`${t.word_length} > 0`),
    check(
      'wordle_global_days_word_matches_length_check',
      sql`char_length(${t.word}) = ${t.word_length}`,
    ),
  ],
);

export const wordleGlobalSessions = pgTable(
  'wordle_global_sessions',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull(),
    word_date: text('word_date').notNull(),
    guesses: text('guesses').notNull().default('[]'),
    solved: boolean('solved').notNull().default(false),
    solved_from_draft: boolean('solved_from_draft').notNull().default(false),
    solved_at: bigint('solved_at', { mode: 'number' }),
    attempts: integer('attempts').notNull().default(0),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    unique().on(t.user_id, t.word_date),
    index('wordle_global_sessions_date_solve_idx').on(t.word_date, t.solved_at),
    check(
      'wordle_global_sessions_draft_win_check',
      sql`NOT ${t.solved_from_draft} OR (${t.solved} AND ${t.attempts} = 0)`,
    ),
  ],
);

export const wordleGlobalAcceptedGuesses = pgTable(
  'wordle_global_accepted_guesses',
  {
    session_id: text('session_id')
      .notNull()
      .references(() => wordleGlobalSessions.id, { onDelete: 'cascade' }),
    user_id: text('user_id').notNull(),
    word_date: text('word_date').notNull(),
    attempt: integer('attempt').notNull(),
    accepted_at: bigint('accepted_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.session_id, t.attempt] }),
    check('wordle_global_accepted_guess_attempt_check', sql`${t.attempt} > 0`),
    index('wordle_global_accepted_guesses_time_idx').on(t.accepted_at),
  ],
);

export const wordleGlobalSessionOrigins = pgTable(
  'wordle_global_session_origins',
  {
    source_session_id: text('source_session_id').primaryKey(),
    global_session_id: text('global_session_id')
      .notNull()
      .references(() => wordleGlobalSessions.id, { onDelete: 'cascade' }),
    guild_id: text('guild_id').notNull(),
    word_date: text('word_date').notNull(),
  },
);

export const wordleGlobalMigrationState = pgTable(
  'wordle_global_migration_state',
  {
    id: text('id').primaryKey(),
    source_digest: text('source_digest').notNull(),
    completed_at: bigint('completed_at', { mode: 'number' }).notNull(),
  },
);

export const wordleGlobalDrafts = pgTable(
  'wordle_global_drafts',
  {
    user_id: text('user_id').notNull(),
    word_date: text('word_date').notNull(),
    row_index: integer('row_index').notNull(),
    cells: jsonb('cells').$type<string[]>().notNull(),
    active_index: integer('active_index').notNull(),
    revision: integer('revision').notNull(),
    updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
    finalized_at: bigint('finalized_at', { mode: 'number' }),
    award_reconciled_at: bigint('award_reconciled_at', { mode: 'number' }),
  },
  (t) => [
    primaryKey({ columns: [t.user_id, t.word_date] }),
    check('wordle_global_drafts_row_index_check', sql`${t.row_index} >= 0`),
    check(
      'wordle_global_drafts_active_index_check',
      sql`${t.active_index} BETWEEN 0 AND 11`,
    ),
    check('wordle_global_drafts_revision_check', sql`${t.revision} > 0`),
    check(
      'wordle_global_drafts_cells_check',
      sql`jsonb_typeof(${t.cells}) = 'array' AND jsonb_array_length(${t.cells}) BETWEEN 5 AND 12`,
    ),
    index('wordle_global_drafts_pending_finalization_idx')
      .on(t.word_date)
      .where(sql`${t.finalized_at} IS NULL`),
    index('wordle_global_drafts_pending_award_idx')
      .on(t.word_date)
      .where(
        sql`${t.finalized_at} IS NOT NULL AND ${t.award_reconciled_at} IS NULL`,
      ),
  ],
);

export const wordleCommunityParticipation = pgTable(
  'wordle_community_participation',
  {
    guild_id: text('guild_id').notNull(),
    user_id: text('user_id').notNull(),
    first_seen_at: bigint('first_seen_at', { mode: 'number' }).notNull(),
    last_seen_at: bigint('last_seen_at', { mode: 'number' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.guild_id, t.user_id] })],
);

export const wordleCommunityDailyPresence = pgTable(
  'wordle_community_daily_presence',
  {
    guild_id: text('guild_id').notNull(),
    user_id: text('user_id').notNull(),
    word_date: text('word_date').notNull(),
    first_seen_at: bigint('first_seen_at', { mode: 'number' }).notNull(),
    recorded_at_ms: bigint('recorded_at_ms', { mode: 'number' })
      .notNull()
      .default(sql`floor(extract(epoch from clock_timestamp()) * 1000)`),
  },
  (t) => [
    primaryKey({ columns: [t.guild_id, t.user_id, t.word_date] }),
    index('wordle_community_presence_date_idx').on(t.guild_id, t.word_date),
  ],
);

export const wordleCommunityFirstSolves = pgTable(
  'wordle_community_first_solves',
  {
    guild_id: text('guild_id').notNull(),
    word_date: text('word_date').notNull(),
    user_id: text('user_id').notNull(),
    session_id: text('session_id').notNull(),
    solved_at: bigint('solved_at', { mode: 'number' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.guild_id, t.word_date] })],
);

export const wordleShowcase = pgTable(
  'wordle_showcase',
  {
    user_id: text('user_id').notNull(),
    slot: integer('slot').notNull(),
    achievement_id: text('achievement_id').notNull(),
    updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.user_id, t.slot] }),
    unique().on(t.user_id, t.achievement_id),
    check('wordle_showcase_slot_check', sql`${t.slot} BETWEEN 1 AND 3`),
  ],
);

export const wordleGlobalAchievements = pgTable(
  'wordle_global_achievements',
  {
    user_id: text('user_id').notNull(),
    achievement_id: text('achievement_id')
      .notNull()
      .references(() => achievements.id),
    unlocked_at: bigint('unlocked_at', { mode: 'number' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.achievement_id] })],
);

export const wordleGlobalDiscoveries = pgTable(
  'wordle_global_discoveries',
  {
    user_id: text('user_id').notNull(),
    pattern_id: text('pattern_id').notNull(),
    session_id: text('session_id').notNull(),
    discovered_at: bigint('discovered_at', { mode: 'number' }).notNull(),
    evidence: jsonb('evidence').$type<unknown>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.pattern_id] })],
);

export const wordleGlobalOccurrences = pgTable(
  'wordle_global_occurrences',
  {
    user_id: text('user_id').notNull(),
    word_date: text('word_date').notNull(),
    pattern_id: text('pattern_id').notNull(),
    session_id: text('session_id').notNull(),
    occurred_at: bigint('occurred_at', { mode: 'number' }).notNull(),
    evidence: jsonb('evidence').$type<unknown>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.user_id, t.word_date, t.pattern_id] }),
    index('wordle_global_occurrences_date_idx').on(t.word_date),
  ],
);

export const wordleAlbumContributions = pgTable(
  'wordle_album_contributions',
  {
    guild_id: text('guild_id').notNull(),
    user_id: text('user_id').notNull(),
    word_date: text('word_date').notNull(),
    pattern_id: text('pattern_id').notNull(),
    occurred_at: bigint('occurred_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.guild_id, t.user_id, t.word_date, t.pattern_id] }),
    foreignKey({
      columns: [t.user_id, t.word_date, t.pattern_id],
      foreignColumns: [
        wordleGlobalOccurrences.user_id,
        wordleGlobalOccurrences.word_date,
        wordleGlobalOccurrences.pattern_id,
      ],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.guild_id, t.user_id, t.word_date],
      foreignColumns: [
        wordleCommunityDailyPresence.guild_id,
        wordleCommunityDailyPresence.user_id,
        wordleCommunityDailyPresence.word_date,
      ],
    }).onDelete('cascade'),
    index('wordle_album_contributions_page_idx').on(
      t.guild_id,
      t.pattern_id,
      t.occurred_at,
    ),
  ],
);

export const wordleAlbumMilestones = pgTable(
  'wordle_album_milestones',
  {
    guild_id: text('guild_id').notNull(),
    family: text('family').notNull(),
    pattern_ids: jsonb('pattern_ids').$type<string[]>().notNull(),
    completed_at: bigint('completed_at', { mode: 'number' }).notNull(),
    revised_at: bigint('revised_at', { mode: 'number' }),
    status: text('status').$type<'completed' | 'revised'>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.guild_id, t.family] }),
    check(
      'wordle_album_milestone_status_check',
      sql`${t.status} IN ('completed', 'revised')`,
    ),
  ],
);

export const wordlePersonalRewards = pgTable(
  'wordle_personal_rewards',
  {
    user_id: text('user_id').notNull(),
    reward_id: text('reward_id').notNull(),
    granted_at: bigint('granted_at', { mode: 'number' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.reward_id] })],
);

export const wordleEquippedRewards = pgTable(
  'wordle_equipped_rewards',
  {
    user_id: text('user_id').notNull(),
    kind: text('kind').$type<'title' | 'frame'>().notNull(),
    reward_id: text('reward_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.user_id, t.kind] }),
    check(
      'wordle_equipped_reward_kind_check',
      sql`${t.kind} IN ('title', 'frame')`,
    ),
    foreignKey({
      columns: [t.user_id, t.reward_id],
      foreignColumns: [
        wordlePersonalRewards.user_id,
        wordlePersonalRewards.reward_id,
      ],
    }).onDelete('cascade'),
  ],
);

export const wordleCommunityGoals = pgTable(
  'wordle_community_goals',
  {
    id: text('id').primaryKey(),
    guild_id: text('guild_id').notNull(),
    target: integer('target').notNull(),
    starts_at: bigint('starts_at', { mode: 'number' }).notNull(),
    ends_at: bigint('ends_at', { mode: 'number' }).notNull(),
    status: text('status')
      .$type<'scheduled' | 'active' | 'finalizing' | 'completed' | 'expired'>()
      .notNull(),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    check('wordle_community_goal_target_check', sql`${t.target} > 0`),
    check(
      'wordle_community_goal_window_check',
      sql`${t.starts_at} < ${t.ends_at}`,
    ),
    check(
      'wordle_community_goal_status_check',
      sql`${t.status} IN ('scheduled', 'active', 'finalizing', 'completed', 'expired')`,
    ),
    index('wordle_community_goals_guild_idx').on(t.guild_id, t.starts_at),
  ],
);

export const wordleGoalContributions = pgTable(
  'wordle_goal_contributions',
  {
    goal_id: text('goal_id')
      .notNull()
      .references(() => wordleCommunityGoals.id, { onDelete: 'cascade' }),
    guild_id: text('guild_id').notNull(),
    user_id: text('user_id').notNull(),
    word_date: text('word_date').notNull(),
    session_id: text('session_id').notNull(),
    attempt: integer('attempt').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.goal_id, t.user_id, t.word_date] }),
    foreignKey({
      columns: [t.session_id, t.attempt],
      foreignColumns: [
        wordleGlobalAcceptedGuesses.session_id,
        wordleGlobalAcceptedGuesses.attempt,
      ],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.guild_id, t.user_id, t.word_date],
      foreignColumns: [
        wordleCommunityDailyPresence.guild_id,
        wordleCommunityDailyPresence.user_id,
        wordleCommunityDailyPresence.word_date,
      ],
    }).onDelete('cascade'),
  ],
);

export const wordleGoalAwards = pgTable(
  'wordle_goal_awards',
  {
    goal_id: text('goal_id')
      .notNull()
      .references(() => wordleCommunityGoals.id, { onDelete: 'cascade' }),
    user_id: text('user_id').notNull(),
    granted_at: bigint('granted_at', { mode: 'number' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.goal_id, t.user_id] })],
);

export const wordleGoalDecorations = pgTable('wordle_goal_decorations', {
  goal_id: text('goal_id')
    .primaryKey()
    .references(() => wordleCommunityGoals.id, { onDelete: 'cascade' }),
  guild_id: text('guild_id').notNull(),
  granted_at: bigint('granted_at', { mode: 'number' }).notNull(),
});
