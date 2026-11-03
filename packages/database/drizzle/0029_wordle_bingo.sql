CREATE TABLE "wordle_bingo_cards" (
  "id" text PRIMARY KEY,
  "guild_id" text NOT NULL,
  "version" integer NOT NULL CHECK ("version" > 0),
  "starts_at" bigint NOT NULL,
  "ends_at" bigint NOT NULL,
  "allow_multi" boolean NOT NULL,
  "cells" jsonb NOT NULL,
  "created_at" bigint NOT NULL,
  CHECK ("starts_at" < "ends_at")
);
--> statement-breakpoint
CREATE INDEX "wordle_bingo_guild_idx" ON "wordle_bingo_cards" ("guild_id", "starts_at");
