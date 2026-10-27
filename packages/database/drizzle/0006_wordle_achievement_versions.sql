CREATE TABLE "wordle_achievement_versions" (
	"version" integer PRIMARY KEY NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"activated_at" bigint NOT NULL,
	CONSTRAINT "wordle_achievement_versions_positive" CHECK ("wordle_achievement_versions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "wordle_pattern_discoveries" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"version" integer NOT NULL,
	"pattern_id" text NOT NULL,
	"session_id" text NOT NULL,
	"discovered_at" bigint NOT NULL,
	"evidence" jsonb NOT NULL,
	CONSTRAINT "wordle_pattern_discoveries_user_id_guild_id_version_pattern_id_pk" PRIMARY KEY("user_id","guild_id","version","pattern_id")
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "wordle_version" integer;--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "archived_at" bigint;--> statement-breakpoint
ALTER TABLE "wordle_sessions" ADD COLUMN "achievement_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "wordle_achievement_versions_active_idx" ON "wordle_achievement_versions" USING btree ("active") WHERE "wordle_achievement_versions"."active" = true;
--> statement-breakpoint
INSERT INTO "wordle_achievement_versions" ("version", "active", "activated_at") VALUES (1, true, 0);
--> statement-breakpoint
UPDATE "achievements" SET "wordle_version" = 1 WHERE "category" = 'wordle';
