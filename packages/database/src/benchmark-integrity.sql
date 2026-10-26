-- Reproducible synthetic plans for the integrity/index migration.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/database/src/benchmark-integrity.sql
BEGIN;

CREATE TEMP TABLE bench_pong_tournaments (guild_id text, created_at bigint);
INSERT INTO bench_pong_tournaments
SELECT 'guild-' || (g % 500), g FROM generate_series(1, 100000) g;
CREATE INDEX ON bench_pong_tournaments (guild_id, created_at DESC);

CREATE TEMP TABLE bench_ai_traces (user_id text, created_at bigint);
INSERT INTO bench_ai_traces
SELECT 'user-' || (g % 5000), g FROM generate_series(1, 200000) g;
CREATE INDEX ON bench_ai_traces (user_id, created_at DESC);

CREATE TEMP TABLE bench_wordlist_review (seq bigint, is_banned boolean);
INSERT INTO bench_wordlist_review
SELECT g, CASE WHEN g % 4 = 0 THEN true WHEN g % 4 = 1 THEN false ELSE NULL END
FROM generate_series(1, 200000) g;
CREATE INDEX ON bench_wordlist_review (seq) WHERE is_banned IS NULL;

CREATE TEMP TABLE bench_user_achievements (
  guild_id text, achievement_id text, user_id text
);
INSERT INTO bench_user_achievements
SELECT 'guild-' || (g % 100), 'achievement-' || (g % 80), 'user-' || g
FROM generate_series(1, 100000) g;
CREATE INDEX ON bench_user_achievements (guild_id, achievement_id, user_id);

CREATE TEMP TABLE bench_ai_thread_sessions (owner_user_id text, thread_id text);
INSERT INTO bench_ai_thread_sessions
SELECT 'user-' || (g % 5000), 'thread-' || g FROM generate_series(1, 100000) g;
CREATE INDEX ON bench_ai_thread_sessions (owner_user_id);

CREATE TEMP TABLE bench_ai_research_jobs (user_id text, job_id text);
INSERT INTO bench_ai_research_jobs
SELECT 'user-' || (g % 5000), 'job-' || g FROM generate_series(1, 100000) g;
CREATE INDEX ON bench_ai_research_jobs (user_id);

CREATE TEMP TABLE bench_wordle_sessions (
  user_id text, guild_id text, attempts int
);
INSERT INTO bench_wordle_sessions
SELECT 'user-' || (g % 1000), 'guild-' || (g % 100), (g % 6) + 1
FROM generate_series(1, 200000) g;
CREATE INDEX ON bench_wordle_sessions (guild_id, user_id) WHERE attempts > 0;
CREATE TEMP TABLE bench_wordle_achievements (
  user_id text, guild_id text, achievement_id text
);
INSERT INTO bench_wordle_achievements
SELECT 'user-' || (g % 1000), 'guild-' || (g % 100), 'badge-' || (g % 25)
FROM generate_series(1, 20000) g;
CREATE INDEX ON bench_wordle_achievements (guild_id, achievement_id, user_id);

ANALYZE bench_pong_tournaments;
ANALYZE bench_ai_traces;
ANALYZE bench_wordlist_review;
ANALYZE bench_user_achievements;
ANALYZE bench_ai_thread_sessions;
ANALYZE bench_ai_research_jobs;
ANALYZE bench_wordle_sessions;
ANALYZE bench_wordle_achievements;

EXPLAIN (ANALYZE, BUFFERS)
SELECT created_at FROM bench_pong_tournaments
WHERE guild_id = 'guild-17' ORDER BY created_at DESC LIMIT 50;
EXPLAIN (ANALYZE, BUFFERS)
SELECT created_at FROM bench_ai_traces
WHERE user_id = 'user-17' ORDER BY created_at DESC LIMIT 50;
EXPLAIN (ANALYZE, BUFFERS)
SELECT seq FROM bench_wordlist_review
WHERE is_banned IS NULL ORDER BY seq LIMIT 100;
EXPLAIN (ANALYZE, BUFFERS)
SELECT user_id FROM bench_user_achievements
WHERE guild_id = 'guild-17' AND achievement_id = 'achievement-17';
EXPLAIN (ANALYZE, BUFFERS)
SELECT thread_id FROM bench_ai_thread_sessions WHERE owner_user_id = 'user-17';
EXPLAIN (ANALYZE, BUFFERS)
SELECT job_id FROM bench_ai_research_jobs WHERE user_id = 'user-17';

EXPLAIN (ANALYZE, BUFFERS)
SELECT a.achievement_id, count(DISTINCT a.user_id)
FROM bench_wordle_achievements a
JOIN bench_wordle_sessions s
  ON s.user_id = a.user_id AND s.guild_id = a.guild_id AND s.attempts > 0
WHERE a.guild_id = 'guild-17'
GROUP BY a.achievement_id;
EXPLAIN (ANALYZE, BUFFERS)
SELECT a.achievement_id, count(DISTINCT a.user_id)
FROM bench_wordle_achievements a
WHERE a.guild_id = 'guild-17'
  AND EXISTS (
    SELECT 1 FROM bench_wordle_sessions s
    WHERE s.user_id = a.user_id AND s.guild_id = a.guild_id AND s.attempts > 0
  )
GROUP BY a.achievement_id;

WITH joined AS (
  SELECT a.achievement_id, count(DISTINCT a.user_id) AS holders
  FROM bench_wordle_achievements a
  JOIN bench_wordle_sessions s
    ON s.user_id = a.user_id AND s.guild_id = a.guild_id AND s.attempts > 0
  WHERE a.guild_id = 'guild-17' GROUP BY a.achievement_id
), existed AS (
  SELECT a.achievement_id, count(DISTINCT a.user_id) AS holders
  FROM bench_wordle_achievements a
  WHERE a.guild_id = 'guild-17'
    AND EXISTS (
      SELECT 1 FROM bench_wordle_sessions s
      WHERE s.user_id = a.user_id AND s.guild_id = a.guild_id AND s.attempts > 0
    )
  GROUP BY a.achievement_id
)
SELECT 'join_minus_exists' AS comparison, count(*) AS differing_rows
FROM ((SELECT * FROM joined EXCEPT SELECT * FROM existed)
      UNION ALL
      (SELECT * FROM existed EXCEPT SELECT * FROM joined)) differences;

ROLLBACK;
