CREATE TABLE "wordle_pattern_challenges" (
  "id" text PRIMARY KEY,
  "guild_id" text NOT NULL,
  "creator_user_id" text,
  "pattern_id" text NOT NULL,
  "opens_at" bigint NOT NULL,
  "closes_at" bigint NOT NULL,
  CHECK ("opens_at" < "closes_at")
);
--> statement-breakpoint
CREATE INDEX "wordle_pattern_challenge_guild_idx" ON "wordle_pattern_challenges" ("guild_id", "opens_at");
--> statement-breakpoint
CREATE TABLE "wordle_challenge_joins" (
  "challenge_id" text NOT NULL REFERENCES "wordle_pattern_challenges" ("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "joined_at" bigint NOT NULL,
  PRIMARY KEY ("challenge_id", "user_id")
);
