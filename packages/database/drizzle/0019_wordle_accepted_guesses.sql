CREATE TABLE "wordle_global_accepted_guesses" (
  "session_id" text NOT NULL REFERENCES "wordle_global_sessions" ("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "word_date" text NOT NULL,
  "attempt" integer NOT NULL CHECK ("attempt" > 0),
  "accepted_at" bigint NOT NULL,
  PRIMARY KEY ("session_id", "attempt")
);
--> statement-breakpoint
CREATE INDEX "wordle_global_accepted_guesses_time_idx" ON "wordle_global_accepted_guesses" ("accepted_at");
