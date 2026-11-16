# Terminhos architecture

Terminhos is one daily game shared by the Discord bot and Activity. A date has
one answer and each player has one session, regardless of which Discord
community they open it from. Guild IDs remain part of requests because
participation, announcements, rankings, and community features still need to
know where a player showed up.

This page describes the current ownership boundaries and progress model. For
the release procedure and preservation gates, see
[Wordle global migration](wordle-global-migration.md) and
[Wordle operations](wordle-operations.md).

## Capability map

| Responsibility | Owner |
| --- | --- |
| HTTP entry point, stable gameplay operations, channel configuration | [`wordle.controller.ts`](../apps/api/src/modules/wordle/wordle.controller.ts), [`wordle.service.ts`](../apps/api/src/modules/wordle/wordle.service.ts), [`wordle.module.ts`](../apps/api/src/modules/wordle/wordle.module.ts) |
| Global answer, player session, drafts, leaderboard and announcement coordination | [`gameplay/`](../apps/api/src/modules/wordle/gameplay) |
| Combined stats, achievements, unlocks, settings and profile projections | [`progression/`](../apps/api/src/modules/wordle/progression) |
| Guild participation, albums, goals, gallery, bingo and challenges | [`community/`](../apps/api/src/modules/wordle/community) |
| Retryable Discord notification delivery | [`notifications/`](../apps/api/src/modules/wordle/notifications) |
| Candidate, validation and reviewed word lists | [`words/`](../apps/api/src/modules/wordle/words) |
| Source inventory, explicit cutover and migration-only reconciliation | [`migration/`](../apps/api/src/modules/wordle/migration) |
| Game-day policy and startup gate | [`wordle-date.ts`](../apps/api/src/modules/wordle/wordle-date.ts), [`wordle-readiness.ts`](../apps/api/src/modules/wordle/wordle-readiness.ts) |
| Request and Activity message schemas | [`HTTP contracts`](../packages/contracts/src/http/routes/wordle.ts), [`Activity messages`](../packages/contracts/src/activity/games/wordle.ts) |
| Pure feedback, stats, achievement and streak rules | [`packages/domain/src/games/wordle/`](../packages/domain/src/games/wordle) |

Runtime services must not import cutover implementations. Migration scripts
and migration tests use those functions directly. Startup reads the receipt
through the readiness check; it never runs a conversion or selects guild
gameplay as a fallback.

## Progress model

The global game stores its answer in `wordle_global_days` and one player session
per user/date in `wordle_global_sessions`. Drafts and accepted-guess events are
also global. The shared `wordle_used_words` pool stays global, so an answer used
in one community is not selected again elsewhere.

`wordle_community_daily_presence` records where players participated. That
community projection supplies guild leaderboards, announcements, first-solver
credit, and community features without making the answer or session guild
specific.

The earlier release stored sessions, drafts, answers, and streak snapshots by
guild. Those original rows remain intact as legacy history. They are read for
combined lifetime totals and for historical guild boards when the answer is
known. If the answer was never stored, the historical board is unavailable;
the session still contributes its supported lifetime counters. Different games
from two guilds on the same date remain distinct games, while streak
calculation counts a solved calendar date once.

At cutover, `wordle_legacy_progress` stores each player's current streak, best
streak, last solved date, and cutoff date. This is an anchor for continuing the
streak in the new global game. It does not fabricate old answers, solve times,
accepted-guess events, or board evidence. Current and best lifetime statistics
are exposed by `WordleHistoryService` in
[`progression/wordle-history.service.ts`](../apps/api/src/modules/wordle/progression/wordle-history.service.ts).

Achievements keep their original unlock timestamp and definition. Retired IDs
remain visible as historical unlocks and are not awarded XP again. Current
answer-, timing-, and drawing-based achievements still require eligible
evidence-backed boards; aggregate legacy totals only advance lifetime counters
and streaks.

## Cutover receipt and startup

The standalone audit and cutover tools take an explicit source tag and date.
The audit records stable keyed hashes of protected source rows without
publishing guesses or connection details. Cutover verifies the source again,
creates carryover/community projections transactionally, and writes the
`global-only-v003` receipt. It does not create historical global answers or
sessions.

API startup runs schema migrations and any configured one-time SQLite import,
then requires a valid receipt before seeding defaults, finalizing drafts, or
starting maintenance. A legacy database without the verified cutover stays
closed. A fresh database must be initialized with an explicit `fresh` receipt.
See the [global migration runbook](wordle-global-migration.md) before preparing
a release.

`forceNewWord` is disabled in global mode and returns HTTP 409. The answer
rotates by date, and a request from another community opens the same session
and draft.

## HTTP and Activity boundary

The bot uses the contract-derived HTTP client. The Activity uses Discord
authentication and a short-lived session token for the shared Colyseus match
room. Both pass a guild ID for community attribution; authenticated user
identity is resolved or checked at the boundary. The active contract schemas
remain the source of request and response shapes.

The Activity persists typed rows as drafts with optimistic revisions. Drafts do
not reveal whether they match the answer. After the day closes, the finalizer
may turn a matching complete draft into a zero-attempt win when the user has no
accepted guesses for that date. Guess persistence commits before achievement
evaluation; a temporary award failure does not reject an accepted guess.
Pending evaluations are persisted and retried by the API. Activity guesses carry
an idempotency key, allowing a lost reply to be recovered without another
attempt or XP award. The bot also reuses a key when retrying a guess request and
pins that request to the daily date it fetched before submission.
The Activity requests a board snapshot after attaching its realtime listener
and after reconnecting, so an early initialization message cannot leave the
board waiting indefinitely.

## Data ownership and deletion

The database schema is defined in
[`packages/database/src/schema/wordle.ts`](../packages/database/src/schema/wordle.ts).
Legacy answers, sessions, drafts, streaks, used-word timestamps, settings,
review order, guild configuration, achievement definitions, unlocks, and XP
remain unchanged by the global cutover. The new receipt and carryover tables are
additive.

Account deletion removes both legacy and global user progress, including
`wordle_legacy_progress`. It retains shared daily answers and the global used
word pool, which are not owned by an individual user. See
[`UserService.deleteAllData()`](../apps/api/src/modules/user/user.service.ts).
