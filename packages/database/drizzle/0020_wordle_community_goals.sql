CREATE TABLE "wordle_community_goals" (
  "id" text PRIMARY KEY,
  "guild_id" text NOT NULL,
  "target" integer NOT NULL CHECK ("target" > 0),
  "starts_at" bigint NOT NULL,
  "ends_at" bigint NOT NULL,
  "status" text NOT NULL CHECK ("status" IN ('scheduled', 'active', 'finalizing', 'completed', 'expired')),
  "created_at" bigint NOT NULL,
  CHECK ("starts_at" < "ends_at")
);
--> statement-breakpoint
CREATE INDEX "wordle_community_goals_guild_idx" ON "wordle_community_goals" ("guild_id", "starts_at");
