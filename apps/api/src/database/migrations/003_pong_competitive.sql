CREATE TABLE IF NOT EXISTS pong_ratings (
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

CREATE INDEX IF NOT EXISTS idx_pong_ratings_leaderboard
  ON pong_ratings(guild_id, pool, rating DESC);

CREATE TABLE IF NOT EXISTS pong_ranked_matches (
  id TEXT NOT NULL PRIMARY KEY,
  session_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  pool TEXT NOT NULL,
  results_json TEXT NOT NULL,
  played_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pong_tournaments (
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

CREATE TABLE IF NOT EXISTS pong_tournament_entries (
  tournament_id TEXT NOT NULL REFERENCES pong_tournaments(id),
  user_id TEXT NOT NULL,
  seed INTEGER NOT NULL,
  rating REAL NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  eliminated INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS pong_tournament_matches (
  id TEXT NOT NULL PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES pong_tournaments(id),
  bracket TEXT NOT NULL,
  round INTEGER NOT NULL,
  position INTEGER NOT NULL,
  player_a TEXT,
  player_b TEXT,
  winner_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'ready', 'complete')),
  UNIQUE (tournament_id, bracket, round, position)
);
