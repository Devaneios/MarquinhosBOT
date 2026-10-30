ALTER TABLE "wordle_achievement_versions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "wordle_achievement_versions" CASCADE;--> statement-breakpoint
ALTER TABLE "wordle_pattern_discoveries" DROP CONSTRAINT "wordle_pattern_discoveries_user_id_guild_id_version_pattern_id_pk";--> statement-breakpoint
ALTER TABLE "wordle_pattern_discoveries" ADD CONSTRAINT "wordle_pattern_discoveries_user_id_guild_id_pattern_id_pk" PRIMARY KEY("user_id","guild_id","pattern_id");--> statement-breakpoint
ALTER TABLE "achievements" DROP COLUMN "wordle_version";--> statement-breakpoint
ALTER TABLE "wordle_pattern_discoveries" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "wordle_sessions" DROP COLUMN "achievement_version";