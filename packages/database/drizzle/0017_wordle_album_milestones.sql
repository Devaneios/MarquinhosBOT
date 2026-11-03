CREATE TABLE "wordle_album_milestones" (
  "guild_id" text NOT NULL,
  "family" text NOT NULL,
  "pattern_ids" jsonb NOT NULL,
  "completed_at" bigint NOT NULL,
  "revised_at" bigint,
  "status" text NOT NULL CHECK ("status" IN ('completed', 'revised')),
  PRIMARY KEY ("guild_id", "family")
);
