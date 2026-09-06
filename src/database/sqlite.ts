import { Database } from 'bun:sqlite';

const SQLITE_PATH = process.env.SQLITE_PATH ?? './marquinhos.db';
const TTL_SECONDS = 600;
const CLEANUP_INTERVAL_MS = 60_000;
const AI_TRACE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export const db = new Database(SQLITE_PATH, { create: true });

db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA synchronous = NORMAL');
db.run('PRAGMA busy_timeout = 5000');

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id                   TEXT NOT NULL PRIMARY KEY,
    lastfm_session_token TEXT,
    lastfm_username      TEXT,
    scrobbles_on         INTEGER
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS scrobbles_queue (
    id            TEXT    NOT NULL PRIMARY KEY,
    track         TEXT    NOT NULL,
    playback_data TEXT    NOT NULL,
    created_at    INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS xp_config (
    event_type  TEXT    NOT NULL PRIMARY KEY,
    xp_amount   INTEGER NOT NULL,
    cooldown_ms INTEGER
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS user_levels (
    user_id     TEXT    NOT NULL,
    guild_id    TEXT    NOT NULL,
    level       INTEGER NOT NULL DEFAULT 1,
    xp          INTEGER NOT NULL DEFAULT 0,
    total_xp    INTEGER NOT NULL DEFAULT 0,
    last_xp_gain INTEGER,
    PRIMARY KEY (user_id, guild_id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS achievements (
    id          TEXT NOT NULL PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL,
    category    TEXT NOT NULL,
    rarity      TEXT NOT NULL CHECK(rarity IN ('common','rare','epic','legendary')),
    icon        TEXT NOT NULL,
    condition   TEXT NOT NULL,
    reward_xp   INTEGER NOT NULL DEFAULT 0
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS user_achievements (
    user_id        TEXT    NOT NULL,
    guild_id       TEXT    NOT NULL,
    achievement_id TEXT    NOT NULL REFERENCES achievements(id),
    unlocked_at    INTEGER NOT NULL,
    PRIMARY KEY (user_id, guild_id, achievement_id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS user_stats (
    user_id          TEXT    NOT NULL,
    guild_id         TEXT    NOT NULL,
    total_commands   INTEGER NOT NULL DEFAULT 0,
    total_scrobbles  INTEGER NOT NULL DEFAULT 0,
    total_voice_joins INTEGER NOT NULL DEFAULT 0,
    total_games      INTEGER NOT NULL DEFAULT 0,
    games_won        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, guild_id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS xp_cooldowns (
    user_id    TEXT    NOT NULL,
    guild_id   TEXT    NOT NULL,
    event_type TEXT    NOT NULL,
    last_gain  INTEGER NOT NULL,
    PRIMARY KEY (user_id, guild_id, event_type)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS game_results (
    id          TEXT    NOT NULL PRIMARY KEY,
    guild_id    TEXT    NOT NULL,
    game_type   TEXT    NOT NULL,
    played_at   INTEGER NOT NULL,
    duration_ms INTEGER
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS user_game_results (
    game_result_id TEXT    NOT NULL REFERENCES game_results(id),
    user_id        TEXT    NOT NULL,
    guild_id       TEXT    NOT NULL,
    position       INTEGER NOT NULL,
    xp_awarded     INTEGER NOT NULL,
    PRIMARY KEY (game_result_id, user_id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS evolutive_achievements (
    user_id       TEXT    NOT NULL,
    guild_id      TEXT    NOT NULL,
    base_id       TEXT    NOT NULL,
    current_tier  INTEGER NOT NULL DEFAULT 1,
    unlocked_at   INTEGER NOT NULL,
    last_evolved  INTEGER,
    evolution_log TEXT    NOT NULL DEFAULT '[]',
    PRIMARY KEY (user_id, guild_id, base_id)
  )
`);

db.run(
  'CREATE INDEX IF NOT EXISTS idx_user_game_results_user ON user_game_results(user_id, guild_id)',
);
db.run(
  'CREATE INDEX IF NOT EXISTS idx_game_results_guild_type ON game_results(guild_id, game_type)',
);
db.run(
  'CREATE INDEX IF NOT EXISTS idx_user_levels_leaderboard ON user_levels(guild_id, level DESC, total_xp DESC)',
);
db.run(
  'CREATE INDEX IF NOT EXISTS idx_scrobbles_queue_ttl ON scrobbles_queue(created_at)',
);

db.run(`
  CREATE TABLE IF NOT EXISTS maze_sessions (
    id          TEXT    NOT NULL PRIMARY KEY,
    user_id     TEXT    NOT NULL,
    guild_id    TEXT    NOT NULL,
    game_mode   TEXT    NOT NULL CHECK(game_mode IN ('open','foggy')),
    maze_width  INTEGER NOT NULL,
    maze_height INTEGER NOT NULL,
    maze_grid   TEXT    NOT NULL,
    player_x    INTEGER NOT NULL,
    player_y    INTEGER NOT NULL,
    moves_count INTEGER NOT NULL DEFAULT 0,
    status      TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','abandoned')),
    started_at  INTEGER NOT NULL,
    completed_at INTEGER
  )
`);

db.run(
  'CREATE INDEX IF NOT EXISTS idx_maze_sessions_user ON maze_sessions(user_id, guild_id, status)',
);

db.run(`
  CREATE TABLE IF NOT EXISTS wordle_used_words (
    word    TEXT    NOT NULL PRIMARY KEY,
    used_at INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS wordle_config (
    guild_id   TEXT    NOT NULL PRIMARY KEY,
    channel_id TEXT    NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS wordle_daily (
    guild_id        TEXT    NOT NULL PRIMARY KEY,
    word            TEXT    NOT NULL,
    word_date       TEXT    NOT NULL,
    players_count   INTEGER NOT NULL DEFAULT 0,
    winners_count   INTEGER NOT NULL DEFAULT 0,
    total_attempts  INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS wordle_sessions (
    id        TEXT    NOT NULL PRIMARY KEY,
    user_id   TEXT    NOT NULL,
    guild_id  TEXT    NOT NULL,
    word_date TEXT    NOT NULL,
    guesses   TEXT    NOT NULL DEFAULT '[]',
    solved    INTEGER NOT NULL DEFAULT 0,
    attempts  INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, guild_id, word_date)
  )
`);

try {
  db.run(
    'ALTER TABLE wordle_sessions ADD COLUMN word_length INTEGER NOT NULL DEFAULT 0',
  );
} catch {
  // Column already exists — safe to ignore
}

db.run(`
  CREATE TABLE IF NOT EXISTS wordlist_review (
    word      TEXT    NOT NULL PRIMARY KEY,
    is_banned INTEGER
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS wordle_streaks (
    user_id          TEXT NOT NULL,
    guild_id         TEXT NOT NULL,
    current_streak   INTEGER NOT NULL DEFAULT 0,
    max_streak       INTEGER NOT NULL DEFAULT 0,
    last_solved_date TEXT,
    PRIMARY KEY (user_id, guild_id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS ai_chat_config (
    key   TEXT    NOT NULL PRIMARY KEY,
    value INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS ai_chat_usage (
    user_id    TEXT    NOT NULL,
    guild_id   TEXT    NOT NULL,
    usage_date TEXT    NOT NULL,
    count      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, guild_id, usage_date)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS ai_chat_global_usage (
    guild_id   TEXT    NOT NULL,
    usage_date TEXT    NOT NULL,
    count      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, usage_date)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS agent_sandbox_sessions (
    user_id       TEXT    NOT NULL,
    guild_id      TEXT    NOT NULL,
    channel_id    TEXT    NOT NULL,
    container_id  TEXT    NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'running',
    created_at    INTEGER NOT NULL,
    last_used_at  INTEGER NOT NULL,
    PRIMARY KEY (user_id, channel_id)
  )
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_agent_sandbox_sessions_status
  ON agent_sandbox_sessions (status, last_used_at)
`);

db.run(`
  CREATE TABLE IF NOT EXISTS ai_agent_usage (
    user_id    TEXT    NOT NULL,
    guild_id   TEXT    NOT NULL,
    usage_date TEXT    NOT NULL,
    count      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, guild_id, usage_date)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS ai_traces (
    trace_id          TEXT    NOT NULL PRIMARY KEY,
    user_id           TEXT    NOT NULL,
    guild_id          TEXT    NOT NULL,
    channel_id        TEXT    NOT NULL,
    content           TEXT    NOT NULL,
    main_category     TEXT,
    category          TEXT,
    status            TEXT,
    reply             TEXT,
    format            TEXT,
    error             TEXT,
    iterations        INTEGER NOT NULL DEFAULT 0,
    tool_calls_used   INTEGER NOT NULL DEFAULT 0,
    prompt_tokens     INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    duration_ms       INTEGER,
    created_at        INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS ai_trace_events (
    id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    trace_id    TEXT    NOT NULL,
    seq         INTEGER NOT NULL,
    type        TEXT    NOT NULL,
    phase       TEXT,
    name        TEXT,
    input       TEXT,
    output      TEXT,
    status      TEXT,
    exit_code   INTEGER,
    duration_ms INTEGER,
    created_at  INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS ai_thread_sessions (
    thread_id      TEXT    NOT NULL PRIMARY KEY,
    guild_id       TEXT    NOT NULL,
    channel_id     TEXT    NOT NULL,
    owner_user_id  TEXT    NOT NULL,
    mode           TEXT    NOT NULL CHECK(mode IN ('ask','research')),
    status         TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
    turn_count     INTEGER NOT NULL DEFAULT 0,
    created_at     INTEGER NOT NULL,
    last_used_at   INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS ai_thread_items (
    id         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    thread_id  TEXT    NOT NULL,
    seq        INTEGER NOT NULL,
    item_json  TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_ai_thread_items_thread
  ON ai_thread_items (thread_id, seq)
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_ai_thread_sessions_last_used
  ON ai_thread_sessions (last_used_at)
`);

db.run(`
  CREATE TABLE IF NOT EXISTS ai_research_jobs (
    job_id          TEXT    NOT NULL PRIMARY KEY,
    idempotency_key TEXT    NOT NULL UNIQUE,
    thread_id       TEXT    NOT NULL,
    user_id         TEXT    NOT NULL,
    guild_id        TEXT    NOT NULL,
    channel_id      TEXT    NOT NULL,
    query           TEXT    NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','done','error')),
    report          TEXT,
    sources         TEXT,
    stats           TEXT,
    error           TEXT,
    created_at      INTEGER NOT NULL,
    finished_at     INTEGER
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS ai_research_events (
    id         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    job_id     TEXT    NOT NULL,
    seq        INTEGER NOT NULL,
    stage      TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_ai_research_events_job
  ON ai_research_events (job_id, seq)
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_ai_research_jobs_created_at
  ON ai_research_jobs (created_at)
`);

db.run(`
  CREATE TABLE IF NOT EXISTS ai_research_usage (
    user_id    TEXT    NOT NULL,
    guild_id   TEXT    NOT NULL,
    usage_date TEXT    NOT NULL,
    count      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, guild_id, usage_date)
  )
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_ai_trace_events_trace
  ON ai_trace_events (trace_id, seq)
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_ai_traces_created_at
  ON ai_traces (created_at)
`);

const cleanupStmt = db.prepare(
  `DELETE FROM scrobbles_queue WHERE created_at < (unixepoch() - ${TTL_SECONDS})`,
);

const traceRetentionDays = Number(process.env.AI_TRACE_RETENTION_DAYS ?? 14);
const traceEventsCleanupStmt = db.prepare(
  `DELETE FROM ai_trace_events WHERE trace_id IN (
     SELECT trace_id FROM ai_traces WHERE created_at < $cutoff
   )`,
);
const traceCleanupStmt = db.prepare(
  'DELETE FROM ai_traces WHERE created_at < $cutoff',
);

const researchRetentionDays = Number(
  process.env.AI_RESEARCH_RETENTION_DAYS ?? 14,
);
const researchEventsCleanupStmt = db.prepare(
  `DELETE FROM ai_research_events WHERE job_id IN (
     SELECT job_id FROM ai_research_jobs WHERE created_at < $cutoff
   )`,
);
const researchJobsCleanupStmt = db.prepare(
  'DELETE FROM ai_research_jobs WHERE created_at < $cutoff',
);

const threadRetentionDays = Number(process.env.AI_THREAD_RETENTION_DAYS ?? 30);
const threadItemsCleanupStmt = db.prepare(
  `DELETE FROM ai_thread_items WHERE thread_id IN (
     SELECT thread_id FROM ai_thread_sessions WHERE last_used_at < $cutoff
   )`,
);
const threadSessionsCleanupStmt = db.prepare(
  'DELETE FROM ai_thread_sessions WHERE last_used_at < $cutoff',
);

function cleanupAiTraces() {
  const cutoff = Date.now() - traceRetentionDays * 24 * 60 * 60 * 1000;
  traceEventsCleanupStmt.run({ $cutoff: cutoff });
  traceCleanupStmt.run({ $cutoff: cutoff });

  const researchCutoff =
    Date.now() - researchRetentionDays * 24 * 60 * 60 * 1000;
  researchEventsCleanupStmt.run({ $cutoff: researchCutoff });
  researchJobsCleanupStmt.run({ $cutoff: researchCutoff });

  // A Discord thread auto-archives long before this; once nobody has spoken in
  // it for a month its transcript is dead weight.
  const threadCutoff = Date.now() - threadRetentionDays * 24 * 60 * 60 * 1000;
  threadItemsCleanupStmt.run({ $cutoff: threadCutoff });
  threadSessionsCleanupStmt.run({ $cutoff: threadCutoff });
}

setInterval(() => {
  try {
    cleanupAiTraces();
  } catch (err) {
    console.error('AI trace retention cleanup error:', err);
  }
}, AI_TRACE_CLEANUP_INTERVAL_MS);

setInterval(() => {
  try {
    cleanupStmt.run();
  } catch (err) {
    console.error('SQLite TTL cleanup error:', err);
  }
}, CLEANUP_INTERVAL_MS);

// Abandon orphaned maze sessions older than 7 days on startup
try {
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  db.query(
    "UPDATE maze_sessions SET status = 'abandoned' WHERE status = 'active' AND started_at < $cutoff",
  ).run({ $cutoff: sevenDaysAgo });
} catch (err) {
  console.error('Maze session cleanup error:', err);
}

console.log(`SQLite database opened at: ${SQLITE_PATH}`);
