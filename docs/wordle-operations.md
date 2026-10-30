# Operate daily Wordle

Use this guide to configure Terminhos, maintain its word banks, backfill
achievements, and verify changes. The [daily Wordle implementation reference](wordle.md)
describes contracts, persistence, and current integration limits.

## Configure a play channel

1. Start the API and bot with the same `MARQUINHOS_API_KEY`.
2. In the target guild, run `/admin termo canal canal:<channel>`.
3. In that channel, submit `/termo palpite:<word>` with a word of the required length.
4. Run `/termo` without a guess to inspect your saved board.
5. Launch Terminhos in the Activity with the same Discord account and guild.

The command and Activity show the same persisted guesses. The Activity uses
Discord authentication and a scoped session token. Keep the bot API key in the
API and bot environments.

For the development stack, follow [local development](local-development.md).
Use `/dev-admin` and `/dev-termo` in `DEV_TEST_CHANNEL_ID` or its threads.
Scheduled rotations, status broadcasts, and the win poller are disabled in
development. An Activity solve therefore has no scheduled Discord announcement
in that environment.

To change the channel through the bot, run the channel command again. If you
change configuration directly through the API or database, restart the bot to
reload its cached channel configuration.

## Set the day boundary

To use the bot's midnight schedule, keep the API's `WORDLE_TIMEZONE` unset or set
it to `America/Recife`. The bot does not read this override.

For local API configuration, set the variable in `apps/api/.env` and restart the
development stack. For a release, set the GitHub Environment variable
`WORDLE_TIMEZONE` and deploy the API through the [deployment workflow](deployment.md).

## Update accepted words

1. Edit `apps/api/wordlist.txt`, `apps/api/devaneios-wordlist.txt`, or both.
2. From the repository root, rebuild the validation bank.

   ```sh
   pnpm --filter marquinhos-web-api exec bun scripts/build-valid-guesses.ts
   ```

3. Inspect the generated diff in `apps/api/valid-guesses.txt`.
4. Rebuild and restart the API image.

The generator prints `valid-guesses.txt generated: <count> words`. The API image
build also runs the generator. For development, restart `pnpm run dev` to rebuild
changed image layers. A source-watch restart alone does not replace word files
copied into the image.

To review existing general-bank words, run `/admin wordlist review`. Choose
`keep` or `remove` for each entry. A removal affects future answers but leaves
the word valid as a guess. The queue seeds only when empty, so adding words to
the file does not extend an already seeded review queue.

## Reset today's puzzle for testing

This action deletes today's sessions for the entire guild and resets the day's
counters. Streak rows, earned achievements, and XP remain.

1. In a test guild, run `/admin termo novo`.
2. Close and reopen the Activity to initialize the board with the new answer length.
3. Submit a guess through `/termo`.
4. Reopen the Activity and verify that it restores the same guess.

## Zero-attempt draft wins

The API saves the Activity's typed row and the values delivered through bot
autocomplete. A draft never reveals whether it matches the answer. After the
configured Wordle date closes, a background finalizer runs on startup and every
30 seconds. It records a zero-attempt win only when the saved final draft still
matches the answer and the player has no accepted guesses that date. Keep the
API connected to the database so it can save delivered input; the bot cannot
persist edits Discord does not send to autocomplete. Overview reads do not run
finalization. The finalizer retries pending achievement awards after a failure.

## Seed the collection and backfill awards

API startup seeds Wordle metadata from the source catalog. Existing sessions
with eligible dates and counters participate immediately; no activation command
or session-version boundary is involved. The `wordle_v2_` prefix on IDs is
historical naming, not a runtime version. Startup stores Wordle conditions as
null because evaluation functions remain in the domain source.

An overview read does not write discoveries, unlocks, or XP. Accepted guesses
trigger best-effort awards after the guess commits. Run backfill when missed
awards need reconciliation, including after catalog edits or after a temporary
award failure:

```sh
pnpm --filter marquinhos-web-api exec bun scripts/backfillWordleAchievements.ts --guild-id GUILD_ID --batch-size 100
```

Set `DATABASE_URL` for the intended PostgreSQL database and run the script from
a checkout with dependencies installed. Omit `--guild-id` to process every
guild; `--batch-size` accepts 1 through 1000. The script applies migrations,
seeds catalog metadata, then evaluates every player with accepted guesses or a
valid zero-attempt draft win. It reports players processed and newly awarded
achievements. Repeating it does not duplicate unlock rows or XP.

Backfill uses all eligible historical sessions, including boards started before
the current catalog was authored. It does not run as a side effect of viewing
`/termo-conquistas`. The release API image does not include `apps/api/scripts/`,
so run the command from a checkout with access to the target database. The bot's
optional `conquista` argument accepts an achievement ID or exact visible name to
show its drawing preview or saved evidence.

## Verify legal pattern examples

Run the verifier from the repository root.

```sh
bun apps/api/scripts/verifyWordlePatterns.ts
```

The JSON result must report 59 pattern identities and 352 witnesses, including
176 yellow witnesses. This count covers every base mask and variant separately
in green and yellow. The verifier checks source answer banks, accepted distinct
guesses, production feedback, and the default matcher. Yellow examples preserve
every previously discovered green position and finish with a solve. The preview
and evidence clients support six-column drawings such as `triangle_6`.

To regenerate the checked-in fixtures deterministically, run the following command.

```sh
bun apps/api/scripts/verifyWordlePatterns.ts --search
```

Source-bank examples do not establish live answer availability. Before deployment,
compare witness answers with the target database's used-word and banned-word sets.
The verifier deliberately reports that the live pool is unchecked.

## Verify a Wordle change

For the full isolated workspace checks, run this command from the repository root.

```sh
pnpm run dev:test
```

To run focused API tests on the host, set `TEST_DATABASE_URL` to a PostgreSQL
server whose account can create databases. Run the tests from `apps/api` so Bun
loads its database preload.

```sh
env TEST_DATABASE_URL=postgres://USER@HOST/DISPOSABLE_DB pnpm --filter marquinhos-web-api exec bun test \
	tests/wordle.test.ts \
	tests/wordle.spec.ts \
	tests/wordleAchievements.test.ts \
	tests/wordleAchievementProgression.test.ts \
	tests/wordleCatalogInitialization.test.ts \
	tests/wordleDrafts.test.ts \
	tests/gamification.integration.test.ts \
	tests/contracts/gamification.contract.test.ts \
	tests/contracts/wordle.contract.test.ts \
	tests/contracts/wordleAchievements.contract.test.ts \
	tests/protocols/wordle.protocol.test.ts \
	tests/userDeleteAllData.test.ts \
	tests/matchRoomWordle.test.ts
```

To check domain rules and Activity behavior, run the following commands.

```sh
bun test packages/domain/src/games/wordle
pnpm --filter marquinhosbot exec bun test src/commands/games/termo.test.ts src/ui/screens/termoAchievements.test.ts
pnpm --filter marquinhos-activity-client exec bun test src/games/wordle
pnpm --filter @marquinhos/domain typecheck
pnpm --filter @marquinhos/domain lint
```

Use the following suites when a change affects those parts of the implementation.

| Change                                                                  | Tests                                                                                                                                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feedback, canonical spelling, and day counters                          | `apps/api/tests/wordle.test.ts`, `apps/api/tests/wordle.spec.ts`                                                                                                       |
| Draft edits, rollover, zero-attempt wins, and streak races              | `apps/api/tests/wordleDrafts.test.ts`                                                                                                                                  |
| Achievement awards, progression, hidden metadata, and backfill retries  | `apps/api/tests/wordleAchievements.test.ts`, `apps/api/tests/wordleAchievementProgression.test.ts`                                                                     |
| Catalog seeding, batched rewards, and generic achievement contracts     | `apps/api/tests/wordleCatalogInitialization.test.ts`, `apps/api/tests/gamification.integration.test.ts`, `apps/api/tests/contracts/gamification.contract.test.ts`      |
| Wordle HTTP and realtime payloads                                       | `apps/api/tests/contracts/wordle.contract.test.ts`, `apps/api/tests/contracts/wordleAchievements.contract.test.ts`, `apps/api/tests/protocols/wordle.protocol.test.ts` |
| Pure achievement rules and statistics                                   | `bun test packages/domain/src/games/wordle`                                                                                                                            |
| Board input, draft restoration, reveal timing, and achievement progress | `apps/activity/src/games/wordle/`                                                                                                                                      |
| Bot autocomplete drafts and achievement rendering                       | `apps/bot/src/commands/games/termo.test.ts`, `apps/bot/src/ui/screens/termoAchievements.test.ts`                                                                       |
| Data erasure and Wordle room initialization                             | `apps/api/tests/userDeleteAllData.test.ts`, `apps/api/tests/matchRoomWordle.test.ts`                                                                                   |
| SQLite import                                                           | `packages/database/src/etl/importSqlite.test.ts`                                                                                                                       |

For live acceptance, use a test guild and follow this sequence.

1. Submit a valid wrong guess through `/termo`.
2. Open the Activity and verify that the saved guess appears without another reveal.
3. Submit a duplicate guess and verify that the attempt count stays unchanged.
4. Change keyboard settings and reopen the Activity to verify persistence.
5. Solve the puzzle and inspect `/termo-conquistas` for the saved statistics and awards.
6. Outside development mode, verify that the configured channel receives one win announcement.

For migration work, follow the audit and rollback steps in
[deployment](deployment.md). Check the [current integration limits](wordle.md#current-integration-limits)
before testing midnight rotation or a board left open across a reset.
