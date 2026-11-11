# Global Wordle cutover runbook

This runbook moves a frozen `v0.0.3` Wordle database to global gameplay while
retaining its supported progress as legacy history. It does not convert old
guild boards into global boards. Never run the cutover against production until
the complete procedure has passed against a representative restored copy.

The cutover is a one-time release operation. Schedule it for a future
`WORDLE_TIMEZONE` calendar date, normally `America/Recife`, and keep Wordle
writers stopped until the new API has opened successfully and smoke checks
pass. Do not run a release with an unknown database source or incomplete audit.

## Stop/go gate

Proceed only when all of these are true:

- The database is a restored backup of the exact frozen source, and the backup
  has passed a restore rehearsal.
- The running source release is confirmed as `v0.0.3` (pinned source commit
  `44e8394be8fdb8dd11fec7c27e9476d02629470a`). The audit artifact records the
  expected tag but cannot prove which release wrote the database.
- The database engine and schema match the rehearsed PostgreSQL source. If the
  deployment is importing SQLite, rehearse that import path separately on the
  restored copy before this procedure.
- No old API, bot command, scheduled worker, or other writer can change Wordle
  sessions, streaks, used words, settings, guild configuration, achievements,
  or XP during audit and cutover.
- The selected cutoff is the first date for global gameplay in
  `WORDLE_TIMEZONE`. The old release is frozen before that date begins.
- Before and after inventories, logs, and the restored database are retained
  in access-controlled release storage. Audit artifacts contain hashes of
  progress records; protect them like operational data.

If any check fails, stop. Keep the source frozen and resolve the discrepancy
on the rehearsal copy before scheduling another attempt.

## Prepare the frozen source

1. Stop the API, bot, scheduled jobs, and any other process that can write
   Wordle or shared achievement data. Record the deployed release, database
   engine/version, schema migration state, `WORDLE_TIMEZONE`, and planned
   cutoff date.
2. Take a database backup and verify that it restores to an isolated database.
   Perform the remaining steps against that restored copy first. Keep the
   frozen source backup unchanged.
3. From a checkout containing this migration code, point `DATABASE_URL` at the
   isolated restored copy and create a new protected inventory artifact:

   ```sh
   bun apps/api/scripts/auditGlobalWordle.ts \
     --output /protected/wordle-v003-before.json
   ```

   The tool opens a read-only repeatable-read transaction. Review its output:
   user count, unknown-answer days, dates with multiple guild games, inspected
   tables, and source digest. Unknown answers and multiple guild games are
   reported, not discarded; retain that report for history and ranking checks.
   Resolve invalid-data issues before continuing. Do not edit the artifact or
   reuse one from a different database snapshot.

4. Record a separate protected SHA-256 of the artifact and verify that the
   database source is in fact the frozen `v0.0.3` deployment. The embedded tag
   is an expected source label, not database attestation.

## Apply and verify on the restored copy

1. Apply checked-in schema migrations using the same API startup migration
   runner, without starting application services. From the repository root,
   with `DATABASE_URL` pointing at the restored copy, run:

   ```sh
   pnpm --filter marquinhos-web-api exec bun -e 'import { runMigrations } from "@marquinhos/database/migrate"; import { closeDefaultDb } from "@marquinhos/database/client"; await runMigrations(); await closeDefaultDb();'
   ```

   This applies the same Drizzle migrations as API startup. Normal startup
   checks the receipt after schema migrations and must not be used as a
   migration-only process; it will stop at the readiness gate before default
   data writes or game maintenance.

2. The cutover command verifies the protected source rows against the original
   inventory. If migration tooling or rehearsal setup may have changed legacy
   rows, produce a new audit and reconcile the discrepancy before continuing.
3. Choose a `YYYY-MM-DD` cutoff in the configured Wordle timezone. Run a dry
   run first (dry run is the default):

   ```sh
   DATABASE_URL="$DATABASE_URL" bun apps/api/scripts/migrateGlobalWordle.ts \
     --source-tag v0.0.3 \
     --cutover-date YYYY-MM-DD \
     --audit /protected/wordle-v003-before.json
   ```

   Review the output and confirm the source digest, cutoff, carryover counts,
   community projections, and that no legacy sessions, drafts, or daily rows
   exist on or after the cutoff. A cutoff conflict is a stop condition: select
   a valid future date and produce a new audit as needed; never remove source
   rows to make the check pass.

4. Apply against the same frozen restored database and artifact by adding
   `--apply` to the command. The conversion runs transactionally. It adds the
   `global-only-v003` receipt, player streak anchors, and community attendance;
   it does not fabricate old global answers, sessions, solve times, first
   solvers, or accepted-guess evidence.
5. Before starting the candidate API, run the audit script again to create a
   separate after inventory. Compare it with the before inventory using the
   source digest and `verifyWordlePreservation` tooling. Confirm every
   protected legacy row is unchanged; only additive global/carryover rows
   should exist. Retain both artifacts and the cutover output.
6. Start the candidate API on the restored copy. Confirm startup passes the
   receipt gate. Confirm global answer and session identity are shared across
   two test guilds, existing used and banned words are respected, legacy
   boards remain guild-specific when their answer is known, unknown-answer
   boards remain unavailable, and combined lifetime totals and streak
   continuation match the inventory. Confirm old unlocks retain their dates,
   legacy XP is not awarded again, and unsupported historical timing or
   first-solver evidence has not appeared.
7. Rehearse one new global solve and its community projections on the restored
   copy, including history, achievements, leaderboard, and announcement
   behavior. Record any new post-cutover XP separately and confirm it comes
   from the new game only; do not replay old unlock rewards. Verify legacy
   sessions, unlocks, streak snapshots, settings, and used-word timestamps
   remain available. New gameplay may add used words or legitimately increase
   a community XP balance, so compare those against the cutover snapshot with
   the new activity accounted for.

## Production release gates

Production remains a no-go until the restored-copy rehearsal above passes with
representative data and the release owner signs off on both inventories. For
the scheduled release:

1. Freeze writers and take the final verified backup. Use that exact snapshot
   for the before audit.
2. Apply schema migrations, run and review the dry run, then apply the cutover
   with the same audit artifact and selected cutoff.
3. Produce and retain the after audit. Verify receipt readiness, protected
   source rows, carryovers, and smoke checks before reopening traffic.
4. Reopen the global-only API and bot, then observe a new global game before
   enabling other Wordle writers or announcement schedules.

Do not run both old and new APIs against the database after cutover. The old
release does not understand global sessions, so it cannot safely serve as an
application rollback after new global gameplay has been accepted.

## Failure and rollback

Before reopening the application, if cutover or verification fails, keep all
writers stopped. Preserve logs and artifacts. Restore the frozen backup to a
separate database and repeat the rehearsal after diagnosing the failure; do not
manually delete a receipt or partially converted rows to retry in place.

After global gameplay has been accepted, do not restore the `v0.0.3` API as a
rollback against the active database. Stop writers, retain the current
database and audit artifacts, and reconcile the new global writes before any
database restore or forward fix. A restore loses post-backup global progress;
the old application cannot read it. The rollback decision must account for
those accepted sessions and announcements.

## Fresh installations

A genuinely new database also requires an explicit receipt. Audit it and use
`--source-tag fresh` with a cutoff and generated inventory artifact. The fresh
audit must contain no legacy Wordle rows. This path initializes global
readiness and does not carry over progress.
