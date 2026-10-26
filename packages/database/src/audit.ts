import { sql } from 'drizzle-orm';
import { closeDefaultDb, db, type DbExecutor } from './client';

type Issue = { category: string; records: Record<string, unknown>[] };

/**
 * The pre-migration checks read legacy objects (user_game_results.guild_id,
 * wordle_daily, wordle_sessions.word_length) that the contract release drops.
 * Once they are gone there is nothing left to check.
 */
async function legacyObjectsExist(
  executor: DbExecutor,
  objects: Array<[table: string, column?: string]>,
): Promise<boolean> {
  for (const [table, column] of objects) {
    const [found] = await executor.execute<{ present: boolean }>(
      column
        ? sql`SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = ${table} AND column_name = ${column}
              ) AS present`
        : sql`SELECT to_regclass(${table}) IS NOT NULL AS present`,
    );
    if (!found?.present) return false;
  }
  return true;
}

export async function auditData(
  postMigration = false,
  executor: DbExecutor = db,
): Promise<Issue[]> {
  const guildColumnExists = await legacyObjectsExist(executor, [
    ['user_game_results', 'guild_id'],
  ]);
  const wordleLegacyExists = await legacyObjectsExist(executor, [
    ['wordle_daily'],
    ['wordle_sessions', 'word_length'],
  ]);
  const checkGuildMismatch = !postMigration && guildColumnExists;
  const checkLegacyWordle = !postMigration && wordleLegacyExists;
  const checks: Array<[string, ReturnType<typeof sql>]> = [
    [
      checkGuildMismatch ? 'game_result_guild_mismatch' : 'game_result_orphan',
      !checkGuildMismatch
        ? sql`SELECT u.game_result_id, u.user_id
              FROM user_game_results u LEFT JOIN game_results g ON g.id = u.game_result_id
              WHERE g.id IS NULL`
        : sql`SELECT u.game_result_id, u.user_id, u.guild_id AS participant_guild_id,
                     g.guild_id AS game_guild_id
              FROM user_game_results u JOIN game_results g ON g.id = u.game_result_id
              WHERE u.guild_id IS DISTINCT FROM g.guild_id`,
    ],
    [
      'ai_trace_event_orphan_or_duplicate_sequence',
      sql`SELECT e.id, e.trace_id, e.seq,
                 CASE WHEN t.trace_id IS NULL THEN 'orphan' ELSE 'duplicate_seq' END AS issue
          FROM ai_trace_events e LEFT JOIN ai_traces t ON t.trace_id = e.trace_id
          WHERE t.trace_id IS NULL OR EXISTS (
            SELECT 1 FROM ai_trace_events d
            WHERE d.trace_id = e.trace_id AND d.seq = e.seq AND d.id <> e.id
          )`,
    ],
    [
      'ai_thread_item_orphan_or_duplicate_sequence',
      sql`SELECT e.id, e.thread_id, e.seq,
                 CASE WHEN t.thread_id IS NULL THEN 'orphan' ELSE 'duplicate_seq' END AS issue
          FROM ai_thread_items e LEFT JOIN ai_thread_sessions t ON t.thread_id = e.thread_id
          WHERE t.thread_id IS NULL OR EXISTS (
            SELECT 1 FROM ai_thread_items d
            WHERE d.thread_id = e.thread_id AND d.seq = e.seq AND d.id <> e.id
          )`,
    ],
    [
      'ai_research_event_orphan_or_duplicate_sequence',
      sql`SELECT e.id, e.job_id, e.seq,
                 CASE WHEN j.job_id IS NULL THEN 'orphan' ELSE 'duplicate_seq' END AS issue
          FROM ai_research_events e LEFT JOIN ai_research_jobs j ON j.job_id = e.job_id
          WHERE j.job_id IS NULL OR EXISTS (
            SELECT 1 FROM ai_research_events d
            WHERE d.job_id = e.job_id AND d.seq = e.seq AND d.id <> e.id
          )`,
    ],
    [
      'pong_tournament_match_integrity',
      sql`SELECT m.id, m.tournament_id, m.player_a, m.player_b, m.winner_id,
                 CASE WHEN m.player_a IS NOT NULL AND a.user_id IS NULL THEN 'missing_player_a'
                      WHEN m.player_b IS NOT NULL AND b.user_id IS NULL THEN 'missing_player_b'
                      ELSE 'winner_not_participant' END AS issue
          FROM pong_tournament_matches m
          LEFT JOIN pong_tournament_entries a
            ON a.tournament_id = m.tournament_id AND a.user_id = m.player_a
          LEFT JOIN pong_tournament_entries b
            ON b.tournament_id = m.tournament_id AND b.user_id = m.player_b
          WHERE (m.player_a IS NOT NULL AND a.user_id IS NULL)
             OR (m.player_b IS NOT NULL AND b.user_id IS NULL)
             OR (m.winner_id IS NOT NULL AND m.winner_id IS DISTINCT FROM m.player_a
                 AND m.winner_id IS DISTINCT FROM m.player_b)`,
    ],
    [
      checkLegacyWordle
        ? 'wordle_day_conflicting_lengths'
        : 'wordle_day_word_length_mismatch',
      !checkLegacyWordle
        ? sql`SELECT guild_id, word_date, word_length, char_length(word) AS actual_length
              FROM wordle_days
              WHERE word IS NOT NULL AND word_length IS DISTINCT FROM char_length(word)`
        : sql`WITH lengths AS (
            SELECT guild_id, word_date, NULLIF(word_length, 0) AS word_length
            FROM wordle_sessions WHERE word_length > 0
            UNION ALL
            SELECT guild_id, word_date, char_length(word) AS word_length
            FROM wordle_daily
          )
          SELECT guild_id, word_date,
                 array_agg(DISTINCT word_length ORDER BY word_length) AS lengths
          FROM lengths GROUP BY guild_id, word_date
          HAVING count(DISTINCT word_length) > 1`,
    ],
  ];

  const issues: Issue[] = [];
  for (const [category, query] of checks) {
    const records = await executor.execute(query);
    if (records.length) issues.push({ category, records: [...records] });
  }
  return issues;
}

if (import.meta.main) {
  const json = process.argv.includes('--json');
  const postMigration = process.argv.includes('--post');
  try {
    const issues = await auditData(postMigration);
    if (json) {
      console.log(JSON.stringify({ ok: issues.length === 0, issues }, null, 2));
    } else if (issues.length === 0) {
      console.log(
        'Data audit passed; no migration-blocking inconsistencies found.',
      );
    } else {
      for (const issue of issues) {
        console.error(
          `${issue.category}: ${issue.records.length} conflicting record(s)`,
        );
        for (const record of issue.records)
          console.error(`  ${JSON.stringify(record)}`);
      }
    }
    process.exitCode = issues.length ? 1 : 0;
  } catch (error) {
    console.error('Data audit failed:', error);
    process.exitCode = 2;
  } finally {
    await closeDefaultDb();
  }
}
