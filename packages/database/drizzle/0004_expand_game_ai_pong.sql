-- Expand phase: additive only. The previous release keeps working against this
-- schema, so rolling back is "redeploy the previous image". The checks below
-- abort the migration before anything changes.
DO $$
DECLARE conflicts jsonb;
BEGIN
  SELECT jsonb_agg(to_jsonb(c)) INTO conflicts FROM (
    SELECT 'ai_trace_events_orphan' AS issue, e.id, e.trace_id, e.seq
    FROM ai_trace_events e LEFT JOIN ai_traces p ON p.trace_id = e.trace_id
    WHERE p.trace_id IS NULL
    UNION ALL
    SELECT 'ai_trace_events_duplicate_seq', NULL, e.trace_id, e.seq
    FROM ai_trace_events e GROUP BY e.trace_id, e.seq HAVING count(*) > 1
  ) c;
  IF conflicts IS NOT NULL THEN RAISE EXCEPTION 'AI trace conflicts: %', conflicts; END IF;

  SELECT jsonb_agg(to_jsonb(c)) INTO conflicts FROM (
    SELECT 'ai_thread_items_orphan' AS issue, e.id, e.thread_id AS parent_id, e.seq
    FROM ai_thread_items e LEFT JOIN ai_thread_sessions p ON p.thread_id = e.thread_id
    WHERE p.thread_id IS NULL
    UNION ALL
    SELECT 'ai_thread_items_duplicate_seq', NULL, e.thread_id, e.seq
    FROM ai_thread_items e GROUP BY e.thread_id, e.seq HAVING count(*) > 1
  ) c;
  IF conflicts IS NOT NULL THEN RAISE EXCEPTION 'AI thread conflicts: %', conflicts; END IF;

  SELECT jsonb_agg(to_jsonb(c)) INTO conflicts FROM (
    SELECT 'ai_research_events_orphan' AS issue, e.id, e.job_id AS parent_id, e.seq
    FROM ai_research_events e LEFT JOIN ai_research_jobs p ON p.job_id = e.job_id
    WHERE p.job_id IS NULL
    UNION ALL
    SELECT 'ai_research_events_duplicate_seq', NULL, e.job_id, e.seq
    FROM ai_research_events e GROUP BY e.job_id, e.seq HAVING count(*) > 1
  ) c;
  IF conflicts IS NOT NULL THEN RAISE EXCEPTION 'AI research conflicts: %', conflicts; END IF;

  SELECT jsonb_agg(to_jsonb(c)) INTO conflicts FROM (
    SELECT m.id, m.tournament_id, m.player_a, m.player_b, m.winner_id,
           CASE WHEN a.user_id IS NULL AND m.player_a IS NOT NULL THEN 'missing_player_a'
                WHEN b.user_id IS NULL AND m.player_b IS NOT NULL THEN 'missing_player_b'
                ELSE 'winner_not_participant' END AS issue
    FROM pong_tournament_matches m
    LEFT JOIN pong_tournament_entries a ON a.tournament_id = m.tournament_id AND a.user_id = m.player_a
    LEFT JOIN pong_tournament_entries b ON b.tournament_id = m.tournament_id AND b.user_id = m.player_b
    WHERE (m.player_a IS NOT NULL AND a.user_id IS NULL)
       OR (m.player_b IS NOT NULL AND b.user_id IS NULL)
       OR (m.winner_id IS NOT NULL AND m.winner_id IS DISTINCT FROM m.player_a
           AND m.winner_id IS DISTINCT FROM m.player_b)
  ) c;
  IF conflicts IS NOT NULL THEN RAISE EXCEPTION 'Pong tournament conflicts: %', conflicts; END IF;
END $$;
--> statement-breakpoint
DROP INDEX "idx_ai_research_events_job";--> statement-breakpoint
DROP INDEX "idx_ai_thread_items_thread";--> statement-breakpoint
DROP INDEX "idx_ai_trace_events_trace";--> statement-breakpoint
ALTER TABLE "user_game_results" ALTER COLUMN "guild_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_research_events" ADD CONSTRAINT "ai_research_events_job_id_ai_research_jobs_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."ai_research_jobs"("job_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_thread_items" ADD CONSTRAINT "ai_thread_items_thread_id_ai_thread_sessions_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."ai_thread_sessions"("thread_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_trace_events" ADD CONSTRAINT "ai_trace_events_trace_id_ai_traces_trace_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."ai_traces"("trace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pong_tournament_matches" ADD CONSTRAINT "pong_tournament_matches_player_a_fk" FOREIGN KEY ("tournament_id","player_a") REFERENCES "public"."pong_tournament_entries"("tournament_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pong_tournament_matches" ADD CONSTRAINT "pong_tournament_matches_player_b_fk" FOREIGN KEY ("tournament_id","player_b") REFERENCES "public"."pong_tournament_entries"("tournament_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_research_jobs_user" ON "ai_research_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_thread_sessions_owner" ON "ai_thread_sessions" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_traces_user_created" ON "ai_traces" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_user_achievements_guild_achievement_user" ON "user_achievements" USING btree ("guild_id","achievement_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_user_game_results_user_game" ON "user_game_results" USING btree ("user_id","game_result_id");--> statement-breakpoint
CREATE INDEX "idx_pong_tournaments_guild_created" ON "pong_tournaments" USING btree ("guild_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "ai_research_events" ADD CONSTRAINT "ai_research_events_job_seq_unique" UNIQUE("job_id","seq");--> statement-breakpoint
ALTER TABLE "ai_thread_items" ADD CONSTRAINT "ai_thread_items_thread_seq_unique" UNIQUE("thread_id","seq");--> statement-breakpoint
ALTER TABLE "ai_trace_events" ADD CONSTRAINT "ai_trace_events_trace_seq_unique" UNIQUE("trace_id","seq");--> statement-breakpoint
ALTER TABLE "pong_tournament_matches" ADD CONSTRAINT "pong_tournament_matches_winner_check" CHECK ("pong_tournament_matches"."winner_id" IS NULL OR coalesce("pong_tournament_matches"."winner_id" = "pong_tournament_matches"."player_a", false) OR coalesce("pong_tournament_matches"."winner_id" = "pong_tournament_matches"."player_b", false));
--> statement-breakpoint
-- Compat for the previous release: user_game_results.guild_id is legacy (the
-- guild lives on game_results). New code omits it, so fill it in. Dropped in
-- the contract release.
CREATE FUNCTION user_game_results_fill_guild() RETURNS trigger AS $$
BEGIN
  IF NEW.guild_id IS NULL THEN
    SELECT guild_id INTO NEW.guild_id FROM game_results WHERE id = NEW.game_result_id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER user_game_results_fill_guild BEFORE INSERT ON user_game_results
FOR EACH ROW EXECUTE FUNCTION user_game_results_fill_guild();
