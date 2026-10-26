-- Expand phase: wordle_days is added and backfilled; wordle_daily and
-- wordle_sessions.word_length stay, kept in sync by the triggers below, so the
-- previous release keeps working and rolling back is "redeploy the previous
-- image". The sessions -> wordle_days foreign key is deferred to the contract
-- release because the previous release inserts sessions without a day row.
DO $$
DECLARE conflicts jsonb;
BEGIN
  WITH lengths AS (
    SELECT guild_id, word_date, NULLIF(word_length, 0) AS word_length
    FROM wordle_sessions WHERE word_length > 0
    UNION ALL
    SELECT guild_id, word_date, char_length(word) AS word_length
    FROM wordle_daily
  )
  SELECT jsonb_agg(jsonb_build_object(
    'guild_id', guild_id, 'word_date', word_date, 'lengths', lengths
  )) INTO conflicts
  FROM (
    SELECT guild_id, word_date, array_agg(DISTINCT word_length ORDER BY word_length) AS lengths
    FROM lengths GROUP BY guild_id, word_date
    HAVING count(DISTINCT word_length) > 1
  ) c;
  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'Conflicting Wordle answer lengths; resolve these days before migration: %', conflicts;
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE "wordle_days" (
	"guild_id" text NOT NULL,
	"word_date" text NOT NULL,
	"word" text,
	"word_length" integer,
	"is_legacy" boolean DEFAULT false NOT NULL,
	"players_count" integer DEFAULT 0 NOT NULL,
	"winners_count" integer DEFAULT 0 NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "wordle_days_guild_id_word_date_pk" PRIMARY KEY("guild_id","word_date"),
	CONSTRAINT "wordle_days_word_length_check" CHECK ("wordle_days"."word_length" IS NULL OR "wordle_days"."word_length" > 0),
	CONSTRAINT "wordle_days_word_matches_length_check" CHECK ("wordle_days"."word" IS NULL OR ("wordle_days"."word_length" IS NOT NULL AND char_length("wordle_days"."word") = "wordle_days"."word_length")),
	CONSTRAINT "wordle_days_current_word_required_check" CHECK ("wordle_days"."is_legacy" OR ("wordle_days"."word" IS NOT NULL AND "wordle_days"."word_length" IS NOT NULL))
);
--> statement-breakpoint
WITH days AS (
  SELECT guild_id, word_date FROM wordle_daily
  UNION
  SELECT guild_id, word_date FROM wordle_sessions
), session_stats AS (
  SELECT guild_id, word_date,
         max(word_length) FILTER (WHERE word_length > 0) AS known_length,
         count(*) FILTER (WHERE attempts > 0)::integer AS players_count,
         count(*) FILTER (WHERE solved)::integer AS winners_count,
         coalesce(sum(attempts) FILTER (WHERE solved), 0)::integer AS total_attempts,
         min(created_at) AS created_at
  FROM wordle_sessions GROUP BY guild_id, word_date
)
INSERT INTO wordle_days (
  guild_id, word_date, word, word_length, is_legacy,
  players_count, winners_count, total_attempts, created_at
)
SELECT d.guild_id, d.word_date, old.word,
       coalesce(char_length(old.word), ss.known_length), true,
       coalesce(old.players_count, ss.players_count, 0),
       coalesce(old.winners_count, ss.winners_count, 0),
       coalesce(old.total_attempts, ss.total_attempts, 0),
       coalesce(old.created_at, ss.created_at)
FROM days d
LEFT JOIN wordle_daily old USING (guild_id, word_date)
LEFT JOIN session_stats ss USING (guild_id, word_date);
--> statement-breakpoint
CREATE INDEX "wordlist_review_pending_seq_idx" ON "wordlist_review" USING btree ("seq") WHERE "wordlist_review"."is_banned" IS NULL;
--> statement-breakpoint
-- Compat triggers (all dropped in the contract release). pg_trigger_depth() > 1
-- stops the two sync directions from echoing into each other.
CREATE FUNCTION wordle_days_to_daily() RETURNS trigger AS $$
BEGIN
  IF pg_trigger_depth() > 1 OR NEW.word IS NULL THEN RETURN NULL; END IF;
  INSERT INTO wordle_daily (guild_id, word, word_date, players_count, winners_count, total_attempts, created_at)
  VALUES (NEW.guild_id, NEW.word, NEW.word_date, NEW.players_count, NEW.winners_count, NEW.total_attempts, NEW.created_at)
  ON CONFLICT (guild_id) DO UPDATE SET
    word = EXCLUDED.word, word_date = EXCLUDED.word_date,
    players_count = EXCLUDED.players_count, winners_count = EXCLUDED.winners_count,
    total_attempts = EXCLUDED.total_attempts, created_at = EXCLUDED.created_at
  WHERE wordle_daily.word_date <= EXCLUDED.word_date;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER wordle_days_to_daily AFTER INSERT OR UPDATE ON wordle_days
FOR EACH ROW EXECUTE FUNCTION wordle_days_to_daily();
--> statement-breakpoint
CREATE FUNCTION wordle_daily_to_days() RETURNS trigger AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  INSERT INTO wordle_days (guild_id, word_date, word, word_length, is_legacy, players_count, winners_count, total_attempts, created_at)
  VALUES (NEW.guild_id, NEW.word_date, NEW.word, char_length(NEW.word), false, NEW.players_count, NEW.winners_count, NEW.total_attempts, NEW.created_at)
  ON CONFLICT (guild_id, word_date) DO UPDATE SET
    word = EXCLUDED.word, word_length = EXCLUDED.word_length, is_legacy = false,
    players_count = EXCLUDED.players_count, winners_count = EXCLUDED.winners_count,
    total_attempts = EXCLUDED.total_attempts;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER wordle_daily_to_days AFTER INSERT OR UPDATE ON wordle_daily
FOR EACH ROW EXECUTE FUNCTION wordle_daily_to_days();
--> statement-breakpoint
CREATE FUNCTION wordle_sessions_fill_day() RETURNS trigger AS $$
BEGIN
  IF NEW.word_length IS NULL OR NEW.word_length = 0 THEN
    SELECT coalesce(word_length, 0) INTO NEW.word_length
    FROM wordle_days WHERE guild_id = NEW.guild_id AND word_date = NEW.word_date;
    NEW.word_length := coalesce(NEW.word_length, 0);
  END IF;
  INSERT INTO wordle_days (guild_id, word_date, word_length, is_legacy, created_at)
  VALUES (NEW.guild_id, NEW.word_date, NULLIF(NEW.word_length, 0), true, NEW.created_at)
  ON CONFLICT (guild_id, word_date) DO NOTHING;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER wordle_sessions_fill_day BEFORE INSERT ON wordle_sessions
FOR EACH ROW EXECUTE FUNCTION wordle_sessions_fill_day();
