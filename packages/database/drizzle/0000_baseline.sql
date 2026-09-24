CREATE TABLE "activity_deep_links" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"game" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "activity_deep_links_user_id_guild_id_pk" PRIMARY KEY("user_id","guild_id")
);
--> statement-breakpoint
CREATE TABLE "maze_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"game_mode" text NOT NULL,
	"maze_width" integer NOT NULL,
	"maze_height" integer NOT NULL,
	"maze_grid" text NOT NULL,
	"player_x" integer NOT NULL,
	"player_y" integer NOT NULL,
	"moves_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" bigint NOT NULL,
	"completed_at" bigint,
	CONSTRAINT "maze_sessions_game_mode_check" CHECK ("maze_sessions"."game_mode" IN ('open','foggy')),
	CONSTRAINT "maze_sessions_status_check" CHECK ("maze_sessions"."status" IN ('active','completed','abandoned'))
);
--> statement-breakpoint
CREATE TABLE "agent_sandbox_sessions" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"container_id" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"created_at" bigint NOT NULL,
	"last_used_at" bigint NOT NULL,
	CONSTRAINT "agent_sandbox_sessions_user_id_channel_id_pk" PRIMARY KEY("user_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "ai_agent_usage" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"usage_date" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_agent_usage_user_id_guild_id_usage_date_pk" PRIMARY KEY("user_id","guild_id","usage_date")
);
--> statement-breakpoint
CREATE TABLE "ai_chat_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_global_usage" (
	"guild_id" text NOT NULL,
	"usage_date" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_chat_global_usage_guild_id_usage_date_pk" PRIMARY KEY("guild_id","usage_date")
);
--> statement-breakpoint
CREATE TABLE "ai_chat_usage" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"usage_date" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_chat_usage_user_id_guild_id_usage_date_pk" PRIMARY KEY("user_id","guild_id","usage_date")
);
--> statement-breakpoint
CREATE TABLE "ai_research_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"seq" integer NOT NULL,
	"stage" text NOT NULL,
	"message" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_research_jobs" (
	"job_id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"thread_id" text NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"query" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"report" text,
	"sources" text,
	"stats" text,
	"error" text,
	"created_at" bigint NOT NULL,
	"finished_at" bigint,
	CONSTRAINT "ai_research_jobs_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "ai_research_jobs_status_check" CHECK ("ai_research_jobs"."status" IN ('queued','running','done','error'))
);
--> statement-breakpoint
CREATE TABLE "ai_research_usage" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"usage_date" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_research_usage_user_id_guild_id_usage_date_pk" PRIMARY KEY("user_id","guild_id","usage_date")
);
--> statement-breakpoint
CREATE TABLE "ai_thread_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"seq" integer NOT NULL,
	"item_json" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_thread_sessions" (
	"thread_id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"turn_count" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"last_used_at" bigint NOT NULL,
	CONSTRAINT "ai_thread_sessions_mode_check" CHECK ("ai_thread_sessions"."mode" IN ('ask','research')),
	CONSTRAINT "ai_thread_sessions_status_check" CHECK ("ai_thread_sessions"."status" IN ('active','closed'))
);
--> statement-breakpoint
CREATE TABLE "ai_trace_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"trace_id" text NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"phase" text,
	"name" text,
	"input" text,
	"output" text,
	"status" text,
	"exit_code" integer,
	"duration_ms" bigint,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_traces" (
	"trace_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"content" text NOT NULL,
	"main_category" text,
	"category" text,
	"status" text,
	"reply" text,
	"format" text,
	"error" text,
	"iterations" integer DEFAULT 0 NOT NULL,
	"tool_calls_used" integer DEFAULT 0 NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"duration_ms" bigint,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"rarity" text NOT NULL,
	"icon" text NOT NULL,
	"condition" text NOT NULL,
	"reward_xp" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "achievements_rarity_check" CHECK ("achievements"."rarity" IN ('common','rare','epic','legendary'))
);
--> statement-breakpoint
CREATE TABLE "evolutive_achievements" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"base_id" text NOT NULL,
	"current_tier" integer DEFAULT 1 NOT NULL,
	"unlocked_at" bigint NOT NULL,
	"last_evolved" bigint,
	"evolution_log" text DEFAULT '[]' NOT NULL,
	CONSTRAINT "evolutive_achievements_user_id_guild_id_base_id_pk" PRIMARY KEY("user_id","guild_id","base_id")
);
--> statement-breakpoint
CREATE TABLE "game_results" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"game_type" text NOT NULL,
	"played_at" bigint NOT NULL,
	"duration_ms" bigint
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"achievement_id" text NOT NULL,
	"unlocked_at" bigint NOT NULL,
	"updated_at" bigint,
	CONSTRAINT "user_achievements_user_id_guild_id_achievement_id_pk" PRIMARY KEY("user_id","guild_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE "user_game_results" (
	"game_result_id" text NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"position" integer NOT NULL,
	"xp_awarded" integer NOT NULL,
	CONSTRAINT "user_game_results_game_result_id_user_id_pk" PRIMARY KEY("game_result_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_levels" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"last_xp_gain" bigint,
	"updated_at" bigint,
	CONSTRAINT "user_levels_user_id_guild_id_pk" PRIMARY KEY("user_id","guild_id")
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"total_commands" integer DEFAULT 0 NOT NULL,
	"total_scrobbles" integer DEFAULT 0 NOT NULL,
	"total_voice_joins" integer DEFAULT 0 NOT NULL,
	"total_games" integer DEFAULT 0 NOT NULL,
	"games_won" integer DEFAULT 0 NOT NULL,
	"updated_at" bigint,
	CONSTRAINT "user_stats_user_id_guild_id_pk" PRIMARY KEY("user_id","guild_id")
);
--> statement-breakpoint
CREATE TABLE "xp_config" (
	"event_type" text PRIMARY KEY NOT NULL,
	"xp_amount" integer NOT NULL,
	"cooldown_ms" bigint
);
--> statement-breakpoint
CREATE TABLE "xp_cooldowns" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"event_type" text NOT NULL,
	"last_gain" bigint NOT NULL,
	CONSTRAINT "xp_cooldowns_user_id_guild_id_event_type_pk" PRIMARY KEY("user_id","guild_id","event_type")
);
--> statement-breakpoint
CREATE TABLE "pong_ranked_matches" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"pool" text NOT NULL,
	"results_json" text NOT NULL,
	"played_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pong_ratings" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"pool" text NOT NULL,
	"rating" double precision DEFAULT 1500 NOT NULL,
	"deviation" double precision DEFAULT 350 NOT NULL,
	"volatility" double precision DEFAULT 0.06 NOT NULL,
	"matches" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "pong_ratings_user_id_guild_id_pool_pk" PRIMARY KEY("user_id","guild_id","pool"),
	CONSTRAINT "pong_ratings_pool_check" CHECK ("pong_ratings"."pool" IN ('classic-1v1', 'quad-elimination'))
);
--> statement-breakpoint
CREATE TABLE "pong_tournament_entries" (
	"tournament_id" text NOT NULL,
	"user_id" text NOT NULL,
	"seed" integer NOT NULL,
	"rating" double precision NOT NULL,
	"score" double precision DEFAULT 0 NOT NULL,
	"eliminated" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pong_tournament_entries_tournament_id_user_id_pk" PRIMARY KEY("tournament_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "pong_tournament_matches" (
	"id" text PRIMARY KEY NOT NULL,
	"tournament_id" text NOT NULL,
	"bracket" text NOT NULL,
	"round" integer NOT NULL,
	"position" integer NOT NULL,
	"player_a" text,
	"player_b" text,
	"winner_id" text,
	"status" text NOT NULL,
	"source_a" text,
	"source_b" text,
	CONSTRAINT "pong_tournament_matches_tournament_id_bracket_round_position_unique" UNIQUE("tournament_id","bracket","round","position"),
	CONSTRAINT "pong_tournament_matches_status_check" CHECK ("pong_tournament_matches"."status" IN ('pending', 'ready', 'complete'))
);
--> statement-breakpoint
CREATE TABLE "pong_tournaments" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"name" text NOT NULL,
	"format" text NOT NULL,
	"pool" text NOT NULL,
	"status" text NOT NULL,
	"config_json" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "pong_tournaments_format_check" CHECK ("pong_tournaments"."format" IN ('round-robin', 'double-elimination', 'swiss-playoff')),
	CONSTRAINT "pong_tournaments_status_check" CHECK ("pong_tournaments"."status" IN ('registration', 'active', 'complete'))
);
--> statement-breakpoint
CREATE TABLE "scrobbles_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"track" text NOT NULL,
	"playback_data" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"lastfm_session_token" text,
	"lastfm_username" text,
	"scrobbles_on" boolean,
	"updated_at" bigint
);
--> statement-breakpoint
CREATE TABLE "wordle_config" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wordle_daily" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"word" text NOT NULL,
	"word_date" text NOT NULL,
	"players_count" integer DEFAULT 0 NOT NULL,
	"winners_count" integer DEFAULT 0 NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wordle_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"word_date" text NOT NULL,
	"guesses" text DEFAULT '[]' NOT NULL,
	"solved" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"word_length" integer DEFAULT 0 NOT NULL,
	"announced_at" bigint,
	CONSTRAINT "wordle_sessions_user_id_guild_id_word_date_unique" UNIQUE("user_id","guild_id","word_date")
);
--> statement-breakpoint
CREATE TABLE "wordle_streaks" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"max_streak" integer DEFAULT 0 NOT NULL,
	"last_solved_date" text,
	CONSTRAINT "wordle_streaks_user_id_guild_id_pk" PRIMARY KEY("user_id","guild_id")
);
--> statement-breakpoint
CREATE TABLE "wordle_used_words" (
	"word" text PRIMARY KEY NOT NULL,
	"used_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wordle_user_config" (
	"user_id" text PRIMARY KEY NOT NULL,
	"invert_action_keys" boolean DEFAULT false NOT NULL,
	"enable_sounds" boolean DEFAULT false NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"enable_space_key" boolean DEFAULT false NOT NULL,
	"enable_arrow_keys" boolean DEFAULT false NOT NULL,
	CONSTRAINT "wordle_user_config_arrow_requires_space" CHECK (NOT ("wordle_user_config"."enable_arrow_keys" AND NOT "wordle_user_config"."enable_space_key"))
);
--> statement-breakpoint
CREATE TABLE "wordlist_review" (
	"word" text PRIMARY KEY NOT NULL,
	"is_banned" boolean,
	"seq" bigserial NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_game_results" ADD CONSTRAINT "user_game_results_game_result_id_game_results_id_fk" FOREIGN KEY ("game_result_id") REFERENCES "public"."game_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pong_tournament_entries" ADD CONSTRAINT "pong_tournament_entries_tournament_id_pong_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."pong_tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pong_tournament_matches" ADD CONSTRAINT "pong_tournament_matches_tournament_id_pong_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."pong_tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_maze_sessions_user" ON "maze_sessions" USING btree ("user_id","guild_id","status");--> statement-breakpoint
CREATE INDEX "idx_agent_sandbox_sessions_status" ON "agent_sandbox_sessions" USING btree ("status","last_used_at");--> statement-breakpoint
CREATE INDEX "idx_ai_research_events_job" ON "ai_research_events" USING btree ("job_id","seq");--> statement-breakpoint
CREATE INDEX "idx_ai_research_jobs_created_at" ON "ai_research_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_thread_items_thread" ON "ai_thread_items" USING btree ("thread_id","seq");--> statement-breakpoint
CREATE INDEX "idx_ai_thread_sessions_last_used" ON "ai_thread_sessions" USING btree ("last_used_at");--> statement-breakpoint
CREATE INDEX "idx_ai_trace_events_trace" ON "ai_trace_events" USING btree ("trace_id","seq");--> statement-breakpoint
CREATE INDEX "idx_ai_traces_created_at" ON "ai_traces" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_game_results_guild_type" ON "game_results" USING btree ("guild_id","game_type");--> statement-breakpoint
CREATE INDEX "idx_user_game_results_user" ON "user_game_results" USING btree ("user_id","guild_id");--> statement-breakpoint
CREATE INDEX "idx_user_levels_leaderboard" ON "user_levels" USING btree ("guild_id","level" DESC NULLS LAST,"total_xp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_pong_ratings_leaderboard" ON "pong_ratings" USING btree ("guild_id","pool","rating" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_scrobbles_queue_ttl" ON "scrobbles_queue" USING btree ("created_at");