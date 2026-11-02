CREATE TABLE "wordle_global_days" (
  "word_date" text PRIMARY KEY,
  "word" text NOT NULL,
  "word_length" integer NOT NULL,
  "created_at" bigint NOT NULL,
  CONSTRAINT "wordle_global_days_word_length_check" CHECK ("word_length" > 0),
  CONSTRAINT "wordle_global_days_word_matches_length_check" CHECK (char_length("word") = "word_length")
);
--> statement-breakpoint
CREATE TABLE "wordle_global_sessions" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "word_date" text NOT NULL,
  "guesses" text NOT NULL DEFAULT '[]',
  "solved" boolean NOT NULL DEFAULT false,
  "solved_from_draft" boolean NOT NULL DEFAULT false,
  "solved_at" bigint,
  "attempts" integer NOT NULL DEFAULT 0,
  "created_at" bigint NOT NULL,
  CONSTRAINT "wordle_global_sessions_user_id_word_date_unique" UNIQUE ("user_id", "word_date"),
  CONSTRAINT "wordle_global_sessions_draft_win_check" CHECK (NOT "solved_from_draft" OR ("solved" AND "attempts" = 0))
);
--> statement-breakpoint
CREATE INDEX "wordle_global_sessions_date_solve_idx" ON "wordle_global_sessions" USING btree ("word_date", "solved_at");
--> statement-breakpoint
CREATE TABLE "wordle_community_participation" (
  "guild_id" text NOT NULL,
  "user_id" text NOT NULL,
  "first_seen_at" bigint NOT NULL,
  "last_seen_at" bigint NOT NULL,
  CONSTRAINT "wordle_community_participation_pk" PRIMARY KEY ("guild_id", "user_id")
);
--> statement-breakpoint
CREATE TABLE "wordle_community_daily_presence" (
  "guild_id" text NOT NULL,
  "user_id" text NOT NULL,
  "word_date" text NOT NULL,
  "first_seen_at" bigint NOT NULL,
  CONSTRAINT "wordle_community_daily_presence_pk" PRIMARY KEY ("guild_id", "user_id", "word_date")
);
--> statement-breakpoint
CREATE INDEX "wordle_community_presence_date_idx" ON "wordle_community_daily_presence" USING btree ("guild_id", "word_date");
--> statement-breakpoint
CREATE TABLE "wordle_community_first_solves" (
  "guild_id" text NOT NULL,
  "word_date" text NOT NULL,
  "user_id" text NOT NULL,
  "session_id" text NOT NULL,
  "solved_at" bigint NOT NULL,
  CONSTRAINT "wordle_community_first_solves_pk" PRIMARY KEY ("guild_id", "word_date")
);
--> statement-breakpoint
CREATE TABLE "wordle_showcase" (
  "user_id" text NOT NULL,
  "slot" integer NOT NULL,
  "achievement_id" text NOT NULL,
  "updated_at" bigint NOT NULL,
  CONSTRAINT "wordle_showcase_pk" PRIMARY KEY ("user_id", "slot"),
  CONSTRAINT "wordle_showcase_user_id_achievement_id_unique" UNIQUE ("user_id", "achievement_id"),
  CONSTRAINT "wordle_showcase_slot_check" CHECK ("slot" BETWEEN 1 AND 3)
);
