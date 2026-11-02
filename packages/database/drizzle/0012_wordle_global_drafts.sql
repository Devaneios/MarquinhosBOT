CREATE TABLE "wordle_global_drafts" (
  "user_id" text NOT NULL,
  "word_date" text NOT NULL,
  "row_index" integer NOT NULL,
  "cells" jsonb NOT NULL,
  "active_index" integer NOT NULL,
  "revision" integer NOT NULL,
  "updated_at" bigint NOT NULL,
  "finalized_at" bigint,
  "award_reconciled_at" bigint,
  CONSTRAINT "wordle_global_drafts_user_id_word_date_pk" PRIMARY KEY ("user_id", "word_date"),
  CONSTRAINT "wordle_global_drafts_row_index_check" CHECK ("row_index" >= 0),
  CONSTRAINT "wordle_global_drafts_active_index_check" CHECK ("active_index" BETWEEN 0 AND 11),
  CONSTRAINT "wordle_global_drafts_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "wordle_global_drafts_cells_check" CHECK (jsonb_typeof("cells") = 'array' AND jsonb_array_length("cells") BETWEEN 5 AND 12)
);
--> statement-breakpoint
CREATE INDEX "wordle_global_drafts_pending_finalization_idx" ON "wordle_global_drafts" ("word_date") WHERE "finalized_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "wordle_global_drafts_pending_award_idx" ON "wordle_global_drafts" ("word_date") WHERE "finalized_at" IS NOT NULL AND "award_reconciled_at" IS NULL;
