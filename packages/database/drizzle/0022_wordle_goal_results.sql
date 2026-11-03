CREATE TABLE "wordle_goal_contributions" (
  "goal_id" text NOT NULL REFERENCES "wordle_community_goals" ("id") ON DELETE CASCADE,
  "guild_id" text NOT NULL,
  "user_id" text NOT NULL,
  "word_date" text NOT NULL,
  "session_id" text NOT NULL,
  "attempt" integer NOT NULL,
  PRIMARY KEY ("goal_id", "user_id", "word_date"),
  FOREIGN KEY ("session_id", "attempt") REFERENCES "wordle_global_accepted_guesses" ("session_id", "attempt") ON DELETE CASCADE,
  FOREIGN KEY ("guild_id", "user_id", "word_date") REFERENCES "wordle_community_daily_presence" ("guild_id", "user_id", "word_date") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE "wordle_goal_awards" (
  "goal_id" text NOT NULL REFERENCES "wordle_community_goals" ("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "granted_at" bigint NOT NULL,
  PRIMARY KEY ("goal_id", "user_id")
);
--> statement-breakpoint
CREATE TABLE "wordle_goal_decorations" (
  "goal_id" text PRIMARY KEY REFERENCES "wordle_community_goals" ("id") ON DELETE CASCADE,
  "guild_id" text NOT NULL,
  "granted_at" bigint NOT NULL
);
