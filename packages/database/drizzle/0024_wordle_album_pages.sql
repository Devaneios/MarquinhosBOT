CREATE TABLE "wordle_album_pages" (
  "guild_id" text NOT NULL,
  "pattern_id" text NOT NULL,
  "first_recorded_at" bigint NOT NULL,
  PRIMARY KEY ("guild_id", "pattern_id")
);
