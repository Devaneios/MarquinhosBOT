CREATE TABLE "wordle_album_contributions" (
  "guild_id" text NOT NULL,
  "user_id" text NOT NULL,
  "word_date" text NOT NULL,
  "pattern_id" text NOT NULL,
  "occurred_at" bigint NOT NULL,
  PRIMARY KEY ("guild_id", "user_id", "word_date", "pattern_id"),
  FOREIGN KEY ("user_id", "word_date", "pattern_id") REFERENCES "wordle_global_occurrences" ("user_id", "word_date", "pattern_id") ON DELETE CASCADE,
  FOREIGN KEY ("guild_id", "user_id", "word_date") REFERENCES "wordle_community_daily_presence" ("guild_id", "user_id", "word_date") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "wordle_album_contributions_page_idx" ON "wordle_album_contributions" ("guild_id", "pattern_id", "occurred_at");
