CREATE TABLE IF NOT EXISTS wordle_user_config (
  user_id TEXT NOT NULL PRIMARY KEY,
  invert_action_keys INTEGER NOT NULL DEFAULT 0 CHECK (invert_action_keys IN (0, 1)),
  enable_sounds INTEGER NOT NULL DEFAULT 0 CHECK (enable_sounds IN (0, 1)),
  updated_at INTEGER NOT NULL DEFAULT (cast(strftime('%s','now') as int))
);
