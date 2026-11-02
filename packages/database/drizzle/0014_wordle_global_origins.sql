CREATE TABLE "wordle_global_session_origins" (
  "source_session_id" text PRIMARY KEY,
  "global_session_id" text NOT NULL REFERENCES "wordle_global_sessions"("id") ON DELETE CASCADE,
  "guild_id" text NOT NULL,
  "word_date" text NOT NULL
);
