CREATE TABLE "wordle_global_cutovers" (
	"id" text PRIMARY KEY NOT NULL,
	"source_tag" text NOT NULL,
	"cutover_date" text NOT NULL,
	"source_digest" text NOT NULL,
	"verified_at" bigint NOT NULL,
	"completed_at" bigint NOT NULL,
	CONSTRAINT "wordle_global_cutovers_source_tag_check" CHECK ("wordle_global_cutovers"."source_tag" IN ('v0.0.3', 'fresh')),
	CONSTRAINT "wordle_global_cutovers_cutover_iso" CHECK ("wordle_global_cutovers"."cutover_date" ~ '^\d{4}-\d{2}-\d{2}$'),
	CONSTRAINT "wordle_global_cutovers_digest_check" CHECK ("wordle_global_cutovers"."source_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "wordle_legacy_progress" (
	"user_id" text PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL,
	"last_solved_date" text,
	"cutover_date" text NOT NULL,
	CONSTRAINT "wordle_legacy_progress_current_nonnegative" CHECK ("wordle_legacy_progress"."current_streak" >= 0),
	CONSTRAINT "wordle_legacy_progress_best_nonnegative" CHECK ("wordle_legacy_progress"."best_streak" >= 0),
	CONSTRAINT "wordle_legacy_progress_cutover_iso" CHECK ("wordle_legacy_progress"."cutover_date" ~ '^\d{4}-\d{2}-\d{2}$'),
	CONSTRAINT "wordle_legacy_progress_anchor_iso" CHECK ("wordle_legacy_progress"."last_solved_date" IS NULL OR "wordle_legacy_progress"."last_solved_date" ~ '^\d{4}-\d{2}-\d{2}$')
);
