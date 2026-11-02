CREATE TABLE "wordle_global_achievements" (
  "user_id" text NOT NULL,
  "achievement_id" text NOT NULL REFERENCES "achievements"("id"),
  "unlocked_at" bigint NOT NULL,
  CONSTRAINT "wordle_global_achievements_pk" PRIMARY KEY ("user_id", "achievement_id")
);
--> statement-breakpoint
CREATE TABLE "wordle_global_discoveries" (
  "user_id" text NOT NULL,
  "pattern_id" text NOT NULL,
  "session_id" text NOT NULL,
  "discovered_at" bigint NOT NULL,
  "evidence" jsonb NOT NULL,
  CONSTRAINT "wordle_global_discoveries_pk" PRIMARY KEY ("user_id", "pattern_id")
);
--> statement-breakpoint
CREATE TABLE "wordle_global_occurrences" (
  "user_id" text NOT NULL,
  "word_date" text NOT NULL,
  "pattern_id" text NOT NULL,
  "session_id" text NOT NULL,
  "occurred_at" bigint NOT NULL,
  "evidence" jsonb NOT NULL,
  CONSTRAINT "wordle_global_occurrences_pk" PRIMARY KEY ("user_id", "word_date", "pattern_id")
);
--> statement-breakpoint
CREATE INDEX "wordle_global_occurrences_date_idx" ON "wordle_global_occurrences" ("word_date");
