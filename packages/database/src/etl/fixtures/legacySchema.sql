-- Schema of the last SQLite release (sqlite.ts + migrations 001-007),
-- dumped from a database that code created. Fixture for importSqlite.test.ts.

CREATE TABLE achievements (
    id          TEXT NOT NULL PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL,
    category    TEXT NOT NULL,
    rarity      TEXT NOT NULL CHECK(rarity IN ('common','rare','epic','legendary')),
    icon        TEXT NOT NULL,
    condition   TEXT NOT NULL,
    reward_xp   INTEGER NOT NULL DEFAULT 0
  );

CREATE TABLE activity_deep_links (
    user_id    TEXT    NOT NULL,
    guild_id   TEXT    NOT NULL,
    game       TEXT    NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, guild_id)
  );

CREATE TABLE agent_sandbox_sessions (
    user_id       TEXT    NOT NULL,
    guild_id      TEXT    NOT NULL,
    channel_id    TEXT    NOT NULL,
    container_id  TEXT    NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'running',
    created_at    INTEGER NOT NULL,
    last_used_at  INTEGER NOT NULL,
    PRIMARY KEY (user_id, channel_id)
  );

CREATE TABLE ai_agent_usage (
    user_id    TEXT    NOT NULL,
    guild_id   TEXT    NOT NULL,
    usage_date TEXT    NOT NULL,
    count      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, guild_id, usage_date)
  );

CREATE TABLE ai_chat_config (
    key   TEXT    NOT NULL PRIMARY KEY,
    value INTEGER NOT NULL
  );

CREATE TABLE ai_chat_global_usage (
    guild_id   TEXT    NOT NULL,
    usage_date TEXT    NOT NULL,
    count      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, usage_date)
  );

CREATE TABLE ai_chat_usage (
    user_id    TEXT    NOT NULL,
    guild_id   TEXT    NOT NULL,
    usage_date TEXT    NOT NULL,
    count      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, guild_id, usage_date)
  );

CREATE TABLE ai_research_events (
    id         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    job_id     TEXT    NOT NULL,
    seq        INTEGER NOT NULL,
    stage      TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  );

CREATE TABLE ai_research_jobs (
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
  );

CREATE TABLE ai_research_usage (
    user_id    TEXT    NOT NULL,
    guild_id   TEXT    NOT NULL,
    usage_date TEXT    NOT NULL,
    count      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, guild_id, usage_date)
  );

CREATE TABLE ai_thread_items (
    id         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    thread_id  TEXT    NOT NULL,
    seq        INTEGER NOT NULL,
    item_json  TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  );

CREATE TABLE ai_thread_sessions (
    thread_id      TEXT    NOT NULL PRIMARY KEY,
    guild_id       TEXT    NOT NULL,
    channel_id     TEXT    NOT NULL,
    owner_user_id  TEXT    NOT NULL,
    mode           TEXT    NOT NULL CHECK(mode IN ('ask','research')),
    status         TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
    turn_count     INTEGER NOT NULL DEFAULT 0,
    created_at     INTEGER NOT NULL,
    last_used_at   INTEGER NOT NULL
  );

CREATE TABLE ai_trace_events (
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
  );

CREATE TABLE ai_traces (
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
  );

CREATE TABLE evolutive_achievements (
    user_id       TEXT    NOT NULL,
    guild_id      TEXT    NOT NULL,
    base_id       TEXT    NOT NULL,
    current_tier  INTEGER NOT NULL DEFAULT 1,
    unlocked_at   INTEGER NOT NULL,
    last_evolved  INTEGER,
    evolution_log TEXT    NOT NULL DEFAULT '[]',
    PRIMARY KEY (user_id, guild_id, base_id)
  );

CREATE TABLE game_results (
    id          TEXT    NOT NULL PRIMARY KEY,
    guild_id    TEXT    NOT NULL,
    game_type   TEXT    NOT NULL,
    played_at   INTEGER NOT NULL,
    duration_ms INTEGER
  );

CREATE TABLE maze_sessions (
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
  );

CREATE TABLE pong_ranked_matches (
  id TEXT NOT NULL PRIMARY KEY,
  session_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  pool TEXT NOT NULL,
  results_json TEXT NOT NULL,
  played_at INTEGER NOT NULL
);

CREATE TABLE pong_ratings (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  pool TEXT NOT NULL CHECK(pool IN ('classic-1v1', 'quad-elimination')),
  rating REAL NOT NULL DEFAULT 1500,
  deviation REAL NOT NULL DEFAULT 350,
  volatility REAL NOT NULL DEFAULT 0.06,
  matches INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, guild_id, pool)
);

CREATE TABLE pong_tournament_entries (
  tournament_id TEXT NOT NULL REFERENCES pong_tournaments(id),
  user_id TEXT NOT NULL,
  seed INTEGER NOT NULL,
  rating REAL NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  eliminated INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tournament_id, user_id)
);

CREATE TABLE pong_tournament_matches (
  id TEXT NOT NULL PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES pong_tournaments(id),
  bracket TEXT NOT NULL,
  round INTEGER NOT NULL,
  position INTEGER NOT NULL,
  player_a TEXT,
  player_b TEXT,
  winner_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'ready', 'complete')), source_a TEXT, source_b TEXT,
  UNIQUE (tournament_id, bracket, round, position)
);

CREATE TABLE pong_tournaments (
  id TEXT NOT NULL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  format TEXT NOT NULL CHECK(format IN ('round-robin', 'double-elimination', 'swiss-playoff')),
  pool TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('registration', 'active', 'complete')),
  config_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE scrobbles_queue (
    id            TEXT    NOT NULL PRIMARY KEY,
    track         TEXT    NOT NULL,
    playback_data TEXT    NOT NULL,
    created_at    INTEGER NOT NULL
  );

CREATE TABLE user_achievements (
    user_id        TEXT    NOT NULL,
    guild_id       TEXT    NOT NULL,
    achievement_id TEXT    NOT NULL REFERENCES achievements(id),
    unlocked_at    INTEGER NOT NULL, updated_at INTEGER,
    PRIMARY KEY (user_id, guild_id, achievement_id)
  );

CREATE TABLE user_game_results (
    game_result_id TEXT    NOT NULL REFERENCES game_results(id),
    user_id        TEXT    NOT NULL,
    guild_id       TEXT    NOT NULL,
    position       INTEGER NOT NULL,
    xp_awarded     INTEGER NOT NULL,
    PRIMARY KEY (game_result_id, user_id)
  );

CREATE TABLE user_levels (
    user_id     TEXT    NOT NULL,
    guild_id    TEXT    NOT NULL,
    level       INTEGER NOT NULL DEFAULT 1,
    xp          INTEGER NOT NULL DEFAULT 0,
    total_xp    INTEGER NOT NULL DEFAULT 0,
    last_xp_gain INTEGER, updated_at INTEGER,
    PRIMARY KEY (user_id, guild_id)
  );

CREATE TABLE user_stats (
    user_id          TEXT    NOT NULL,
    guild_id         TEXT    NOT NULL,
    total_commands   INTEGER NOT NULL DEFAULT 0,
    total_scrobbles  INTEGER NOT NULL DEFAULT 0,
    total_voice_joins INTEGER NOT NULL DEFAULT 0,
    total_games      INTEGER NOT NULL DEFAULT 0,
    games_won        INTEGER NOT NULL DEFAULT 0, updated_at INTEGER,
    PRIMARY KEY (user_id, guild_id)
  );

CREATE TABLE users (
    id                   TEXT NOT NULL PRIMARY KEY,
    lastfm_session_token TEXT,
    lastfm_username      TEXT,
    scrobbles_on         INTEGER
  , updated_at INTEGER);

CREATE TABLE wordle_config (
    guild_id   TEXT    NOT NULL PRIMARY KEY,
    channel_id TEXT    NOT NULL,
    updated_at INTEGER NOT NULL
  );

CREATE TABLE wordle_daily (
    guild_id        TEXT    NOT NULL PRIMARY KEY,
    word            TEXT    NOT NULL,
    word_date       TEXT    NOT NULL,
    players_count   INTEGER NOT NULL DEFAULT 0,
    winners_count   INTEGER NOT NULL DEFAULT 0,
    total_attempts  INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL
  );

CREATE TABLE wordle_sessions (
    id        TEXT    NOT NULL PRIMARY KEY,
    user_id   TEXT    NOT NULL,
    guild_id  TEXT    NOT NULL,
    word_date TEXT    NOT NULL,
    guesses   TEXT    NOT NULL DEFAULT '[]',
    solved    INTEGER NOT NULL DEFAULT 0,
    attempts  INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, word_length INTEGER NOT NULL DEFAULT 0, announced_at INTEGER,
    UNIQUE(user_id, guild_id, word_date)
  );

CREATE TABLE wordle_streaks (
    user_id          TEXT NOT NULL,
    guild_id         TEXT NOT NULL,
    current_streak   INTEGER NOT NULL DEFAULT 0,
    max_streak       INTEGER NOT NULL DEFAULT 0,
    last_solved_date TEXT,
    PRIMARY KEY (user_id, guild_id)
  );

CREATE TABLE wordle_used_words (
    word    TEXT    NOT NULL PRIMARY KEY,
    used_at INTEGER NOT NULL
  );

CREATE TABLE wordle_user_config (
  user_id TEXT NOT NULL PRIMARY KEY,
  invert_action_keys INTEGER NOT NULL DEFAULT 0 CHECK (invert_action_keys IN (0, 1)),
  enable_sounds INTEGER NOT NULL DEFAULT 0 CHECK (enable_sounds IN (0, 1)),
  updated_at INTEGER NOT NULL DEFAULT (cast(strftime('%s','now') as int))
, enable_space_key INTEGER NOT NULL DEFAULT 0 CHECK (enable_space_key IN (0, 1)), enable_arrow_keys INTEGER NOT NULL DEFAULT 0 CHECK (enable_arrow_keys IN (0, 1)));

CREATE TABLE wordlist_review (
    word      TEXT    NOT NULL PRIMARY KEY,
    is_banned INTEGER
  );

CREATE TABLE xp_config (
    event_type  TEXT    NOT NULL PRIMARY KEY,
    xp_amount   INTEGER NOT NULL,
    cooldown_ms INTEGER
  );

CREATE TABLE xp_cooldowns (
    user_id    TEXT    NOT NULL,
    guild_id   TEXT    NOT NULL,
    event_type TEXT    NOT NULL,
    last_gain  INTEGER NOT NULL,
    PRIMARY KEY (user_id, guild_id, event_type)
  );

CREATE INDEX idx_agent_sandbox_sessions_status
  ON agent_sandbox_sessions (status, last_used_at)
;

CREATE INDEX idx_ai_research_events_job
  ON ai_research_events (job_id, seq)
;

CREATE INDEX idx_ai_research_jobs_created_at
  ON ai_research_jobs (created_at)
;

CREATE INDEX idx_ai_thread_items_thread
  ON ai_thread_items (thread_id, seq)
;

CREATE INDEX idx_ai_thread_sessions_last_used
  ON ai_thread_sessions (last_used_at)
;

CREATE INDEX idx_ai_trace_events_trace
  ON ai_trace_events (trace_id, seq)
;

CREATE INDEX idx_ai_traces_created_at
  ON ai_traces (created_at)
;

CREATE INDEX idx_game_results_guild_type ON game_results(guild_id, game_type);

CREATE INDEX idx_maze_sessions_user ON maze_sessions(user_id, guild_id, status);

CREATE INDEX idx_pong_ratings_leaderboard
  ON pong_ratings(guild_id, pool, rating DESC);

CREATE INDEX idx_scrobbles_queue_ttl ON scrobbles_queue(created_at);

CREATE INDEX idx_user_game_results_user ON user_game_results(user_id, guild_id);

CREATE INDEX idx_user_levels_leaderboard ON user_levels(guild_id, level DESC, total_xp DESC);

CREATE TRIGGER trg_user_ach_updated_at
AFTER UPDATE ON user_achievements
FOR EACH ROW
BEGIN
  UPDATE user_achievements SET updated_at = cast(strftime('%s','now') as int) WHERE user_id = NEW.user_id AND guild_id = NEW.guild_id AND achievement_id = NEW.achievement_id;
END;

CREATE TRIGGER trg_user_levels_updated_at
AFTER UPDATE ON user_levels
FOR EACH ROW
BEGIN
  UPDATE user_levels SET updated_at = cast(strftime('%s','now') as int) WHERE user_id = NEW.user_id AND guild_id = NEW.guild_id;
END;

CREATE TRIGGER trg_user_stats_updated_at
AFTER UPDATE ON user_stats
FOR EACH ROW
BEGIN
  UPDATE user_stats SET updated_at = cast(strftime('%s','now') as int) WHERE user_id = NEW.user_id AND guild_id = NEW.guild_id;
END;

CREATE TRIGGER trg_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = cast(strftime('%s','now') as int) WHERE id = NEW.id;
END;

CREATE TRIGGER wordle_user_config_arrow_requires_space_insert
BEFORE INSERT ON wordle_user_config
WHEN NEW.enable_arrow_keys = 1 AND NEW.enable_space_key = 0
BEGIN
  SELECT RAISE(ABORT, 'Wordle arrow keys require the space key');
END;

CREATE TRIGGER wordle_user_config_arrow_requires_space_update
BEFORE UPDATE ON wordle_user_config
WHEN NEW.enable_arrow_keys = 1 AND NEW.enable_space_key = 0
BEGIN
  SELECT RAISE(ABORT, 'Wordle arrow keys require the space key');
END;
