CREATE TABLE "wordle_album_projection_queue" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"revision" text DEFAULT gen_random_uuid()::text NOT NULL,
	"retry_at" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "wordle_album_projection_queue_retry_idx" ON "wordle_album_projection_queue" USING btree ("retry_at");
--> statement-breakpoint
INSERT INTO "wordle_album_projection_queue" ("guild_id")
SELECT DISTINCT presence."guild_id"
FROM "wordle_community_daily_presence" AS presence
INNER JOIN "wordle_global_occurrences" AS occurrence
  ON occurrence."user_id" = presence."user_id"
  AND occurrence."word_date" = presence."word_date"
ON CONFLICT ("guild_id") DO NOTHING;
