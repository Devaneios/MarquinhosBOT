ALTER TABLE "wordle_sessions" ADD COLUMN "solved_at" bigint;
--> statement-breakpoint
ALTER TABLE "wordle_sessions" ADD COLUMN "first_solver" boolean;--> statement-breakpoint
CREATE UNIQUE INDEX "wordle_sessions_first_solver_idx" ON "wordle_sessions" USING btree ("guild_id","word_date") WHERE "wordle_sessions"."first_solver" = true;
--> statement-breakpoint
CREATE INDEX "wordle_sessions_guild_solve_idx" ON "wordle_sessions" USING btree ("guild_id","word_date","solved_at");
