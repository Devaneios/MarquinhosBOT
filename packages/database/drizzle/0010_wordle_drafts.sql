CREATE TABLE "wordle_drafts" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"word_date" text NOT NULL,
	"row_index" integer NOT NULL,
	"cells" jsonb NOT NULL,
	"active_index" integer NOT NULL,
	"revision" integer NOT NULL,
	"updated_at" bigint NOT NULL,
	"finalized_at" bigint,
	"award_reconciled_at" bigint,
	CONSTRAINT "wordle_drafts_user_id_guild_id_word_date_pk" PRIMARY KEY("user_id","guild_id","word_date"),
	CONSTRAINT "wordle_drafts_row_index_check" CHECK ("wordle_drafts"."row_index" >= 0),
	CONSTRAINT "wordle_drafts_active_index_check" CHECK ("wordle_drafts"."active_index" BETWEEN 0 AND 11),
	CONSTRAINT "wordle_drafts_revision_check" CHECK ("wordle_drafts"."revision" > 0),
	CONSTRAINT "wordle_drafts_cells_check" CHECK (jsonb_typeof("wordle_drafts"."cells") = 'array' AND jsonb_array_length("wordle_drafts"."cells") BETWEEN 5 AND 12)
);
--> statement-breakpoint
ALTER TABLE "wordle_sessions" ADD COLUMN "solved_from_draft" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "wordle_drafts_pending_finalization_idx" ON "wordle_drafts" USING btree ("word_date","guild_id") WHERE "wordle_drafts"."finalized_at" IS NULL;--> statement-breakpoint
CREATE INDEX "wordle_drafts_pending_award_idx" ON "wordle_drafts" USING btree ("word_date","guild_id") WHERE "wordle_drafts"."finalized_at" IS NOT NULL AND "wordle_drafts"."award_reconciled_at" IS NULL;--> statement-breakpoint
ALTER TABLE "wordle_sessions" ADD CONSTRAINT "wordle_sessions_draft_win_check" CHECK (NOT "wordle_sessions"."solved_from_draft" OR ("wordle_sessions"."solved" AND "wordle_sessions"."attempts" = 0));
