ALTER TABLE "wordle_community_daily_presence" ADD COLUMN "recorded_at_ms" bigint;
--> statement-breakpoint
UPDATE "wordle_community_daily_presence" SET "recorded_at_ms" = "first_seen_at" * 1000;
--> statement-breakpoint
ALTER TABLE "wordle_community_daily_presence" ALTER COLUMN "recorded_at_ms" SET DEFAULT floor(extract(epoch from clock_timestamp()) * 1000);
--> statement-breakpoint
ALTER TABLE "wordle_community_daily_presence" ALTER COLUMN "recorded_at_ms" SET NOT NULL;
