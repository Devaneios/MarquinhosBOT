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

## Start the new achievement collection

This release includes the version-2 catalog but does not activate it through
migrations, startup, or backfill. Activation applies to Wordle achievements across
the database. Existing games and XP remain. Boards that started before activation
stay version 1 and cannot earn version-2 progress, even when solved later.

1. Apply the release migrations using the normal deployment procedure.
2. Set `DATABASE_URL` to the intended database in a checkout with dependencies installed.
3. Inspect the change from the repository root.

   ```sh
   pnpm --filter marquinhos-web-api exec bun scripts/activateWordleAchievements.ts
   ```

4. Review the active and proposed versions, old-definition and unlock counts,
   session versions, and any existing activation timestamp in the JSON report.
5. Stop old API processes and backfill workers. Old binaries do not honor version
   and archival rules and must not restart after the switch.
6. When applying the reviewed activation to that database, run the explicit command.

   ```sh
   pnpm --filter marquinhos-web-api exec bun scripts/activateWordleAchievements.ts --apply
   ```

7. Start only compatible API processes. Confirm that `/termo-conquistas` shows the
   fresh collection while lifetime statistics and existing XP remain intact.
8. Start a new daily board and check that an accepted guess updates the version-2
   collection. An already-started board remains playable in version 1.

The activation tool does not run migrations. Its default mode only reads the
database. Repeating `--apply` preserves the original version-2 activation and all
new progress. Retired definitions and unlocks remain archived for inspection.
No historical XP is subtracted. Use `--help` to inspect the CLI arguments.

The release API image does not include `apps/api/scripts/`. Run the tool from a
checkout with access to the intended database. This procedure does not register
Discord commands. The bot's optional `conquista` argument accepts an achievement
ID or exact visible name to show its drawing preview or earned evidence.

## Verify legal pattern examples

Run the verifier from the repository root.

```sh
bun apps/api/scripts/verifyWordlePatterns.ts
```

The JSON result must report 53 patterns, 106 witnesses, and 53 yellow witnesses.
The verifier checks source answer banks, accepted distinct guesses, production
feedback, and the default matcher. Yellow examples preserve every previously
discovered green position and finish with a solve.

To regenerate the checked-in fixtures deterministically, run the following command.

```sh
bun apps/api/scripts/verifyWordlePatterns.ts --search
```

Source-bank examples do not establish live answer availability. Before deployment,
compare witness answers with the target database's used-word and banned-word sets.
The verifier deliberately reports that the live pool is unchecked.

## Backfill achievement awards

1. Use a checkout with the target release's dependencies installed.
2. Set `DATABASE_URL` to the intended PostgreSQL database.
3. To process one guild, run the following command from the repository root.

   ```sh
   pnpm --filter marquinhos-web-api exec bun scripts/backfillWordleAchievements.ts --guild-id GUILD_ID --batch-size 100
   ```

4. Inspect the JSON output for `playersProcessed` and `achievementsAwarded`.
5. Read `/termo-conquistas` for a processed player to inspect the result.

To process all guilds, omit `--guild-id GUILD_ID`. Use `--batch-size` between
1 and 1000. To inspect arguments, run the command with `--help`.

The script applies pending database migrations and synchronizes achievement
definitions before awarding. It commits each player's evaluation separately.
Only sessions belonging to the active achievement version contribute to new
progress. Backfill never moves the activation boundary or promotes old boards.
If a run stops, rerun the command. Existing unlocks do not grant XP again.
Missing legacy solve times remain unknown, so timing awards require recorded
evidence. Reading the achievement overview alone does not grant missed awards.

The release API image does not copy `apps/api/scripts/`. Run the backfill from a
checkout with database access rather than using that script path inside the
release container.

## Verify a Wordle change

For the full isolated workspace checks, run this command from the repository root.

```sh
pnpm run dev:test
```

To run focused API tests on the host, set `TEST_DATABASE_URL` to a PostgreSQL
server whose account can create databases. Run the tests from `apps/api` so Bun
loads its database preload.

```sh
pnpm --filter marquinhos-web-api exec bun run test \
	tests/wordle.test.ts \
	tests/wordle.spec.ts \
	tests/wordleAnnouncement.test.ts \
	tests/wordleAchievements.test.ts \
	tests/wordleAchievementProgression.test.ts \
	tests/wordleUserConfig.test.ts \
	tests/wordleUserConfigController.test.ts \
	tests/contracts/wordle.contract.test.ts \
	tests/contracts/wordleAchievements.contract.test.ts \
	tests/protocols/wordle.protocol.test.ts \
	tests/matchRoomWordle.test.ts
```

To check domain rules and Activity behavior, run the following commands.

```sh
pnpm --filter @marquinhos/domain exec bun test src/games/wordle/achievements
pnpm --filter marquinhos-activity-client exec bun run test src/games/wordle
```

Use the following suites when a change affects those parts of the implementation.

| Change                                                                             | Tests                                                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feedback, canonical spelling, and unique day guesses                               | `apps/api/tests/wordle.test.ts`                                                                                                                                        |
| Selection, transaction rollback, concurrent first guesses, counters, and rankings  | `apps/api/tests/wordle.spec.ts`                                                                                                                                        |
| Announcement claims                                                                | `apps/api/tests/wordleAnnouncement.test.ts`                                                                                                                            |
| Achievement awards, progression, hidden metadata, statistics, and backfill retries | `apps/api/tests/wordleAchievements.test.ts`, `apps/api/tests/wordleAchievementProgression.test.ts`                                                                     |
| Pure achievement rules and statistics                                              | `packages/domain/src/games/wordle/achievements/*.test.ts`                                                                                                              |
| Settings storage and authentication                                                | `apps/api/tests/wordleUserConfig.test.ts`, `apps/api/tests/wordleUserConfigController.test.ts`                                                                         |
| HTTP and Activity payloads                                                         | `apps/api/tests/contracts/wordle.contract.test.ts`, `apps/api/tests/contracts/wordleAchievements.contract.test.ts`, `apps/api/tests/protocols/wordle.protocol.test.ts` |
| Colyseus initialization                                                            | `apps/api/tests/matchRoomWordle.test.ts`                                                                                                                               |
| Board input, reveal timing, achievements, and settings screens                     | `apps/activity/src/games/wordle/`                                                                                                                                      |
| Discord board and achievement rendering                                            | `apps/bot/src/ui/screens/termo.test.ts`, `apps/bot/src/ui/screens/termoAchievements.test.ts`, `apps/bot/src/commands/games/termoAchievements.test.ts`                  |
| Expand migration compatibility and SQLite import                                   | `packages/database/src/integrity.test.ts`, `packages/database/src/etl/importSqlite.test.ts`                                                                            |

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
