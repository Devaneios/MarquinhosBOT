# Wordle achievement rebuild proposal

Status is discovery, superseded for implementation by the [Wordle achievements design](superpowers/specs/2026-10-26-wordle-achievements-design.md). This document does not describe shipped behavior. The user selected matching subsets of cells and a curated catalog with reusable pattern rules. The stricter alternatives below record the exploration, not the selected behavior.

Players should start a fresh achievement collection that recognizes how they play and the pictures they create in their attempt grids. Existing game history remains useful for lifetime statistics. The next engineer should be able to add a shape through catalog data without writing a new recognition algorithm.

## What works today

The [catalog](../packages/domain/src/games/wordle/achievements/catalog.ts) contains 32 achievements across 9 families and 13 rule kinds. The pure [evaluator](../packages/domain/src/games/wordle/achievements/evaluate.ts), progress payloads, transactional XP rewards, duplicate unlock protection, and both clients are reusable.

The [achievement service](../apps/api/src/services/wordle/WordleAchievementService.ts) reads lifetime session history on each evaluation. Clearing unlocks alone would re-award achievements and XP on a subsequent guess or backfill. Lifetime best streak also feeds the current evaluator.

The daily game has five-letter or six-letter answers and unlimited attempts. An unsolved current day is still in progress. An attempted past day that remains unsolved is a loss. A missing day is an absence.

[Guess rows](../packages/contracts/src/wordle.ts) store the word and its feedback. Session timestamps approximate elapsed time from the first accepted guess to the solve. The service captures the creation timestamp before waiting for the transaction lock, so the interval can include lock wait. These timestamps do not measure active play, time spent preparing the first guess, or pauses between attempts.

## Ways to build it

| Approach                                      | What players get                                             | Maintenance cost                                                       |
| --------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| A small fixed catalog                         | A limited selection of shapes and milestones                 | Each new shape tends to require another custom check                   |
| A curated catalog with reusable pattern rules | A larger collection of drawings, play styles, and milestones | A template registry and a few well-tested matching modes               |
| Player-authored patterns                      | Players create and share their own challenges                | A separate editor, validation, publication, and abuse-handling feature |

The user selected a curated catalog with reusable pattern rules. It fits the existing catalog and award flow. Player-authored challenges remain a separate product choice.

## Recognize pictures without accepting arbitrary subsets

A pattern is a rectangular mask with explicit foreground and background cells. Foreground means one chosen feedback color. Background means that color is absent at that cell. A background cell may therefore be yellow or grey when the foreground is green.

For example, a green T occupies this local window.

```text
GGG
.G.
.G.
```

These are the viable matching modes.

| Mode                      | Meaning                                                                    | Best use                                     |
| ------------------------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| Exact local window        | Match every foreground and background cell in consecutive rows and columns | Letters, digits, arrows, and framed drawings |
| Exact connected component | A complete orthogonally connected group has the required shape and size    | Tetrominoes and isolated shapes              |
| Whole drawing             | Every eligible row and column participates in the template                 | Rarer complete-board compositions            |

The initial recommendation was local windows for glyphs and exact components for tetrominoes. The user chose any matching subset instead. The final design therefore treats background cells as wildcards and allows extra foreground cells, including touching cells. A filled rectangle can contain several shapes. That is an accepted consequence of the selected semantics, not a reason to reject those matches.

The following rules belonged to the initial strict-matching proposal. The final design supersedes them where they conflict with subset matching, especially connected-component isolation and exclusion of the winning row.

- Match green and yellow separately. A mixed green-and-yellow projection is a distinct template option rather than an implicit fallback.
- Exclude the final all-green winning row from shape recognition. Otherwise wins produce trivial bars and symmetry.
- Match real submitted rows. Never pad a short board with empty rows or combine different dates.
- Allow translation. Allow rotations for tetrominoes, but keep J distinct from L and S distinct from Z by excluding reflections.
- Keep letters and digits upright. Rotating a glyph can change its identity.
- Deduplicate equivalent orientations and repeated discoveries. Every achievement grants XP once per player and guild.
- Validate the complete rectangular feedback history independently of whether the board is solved. A partial or malformed history is not evidence.
- Validate the original parsed history against the expected board width and attempt count. The current loader silently removes malformed rows. A shape matcher must not treat the remaining rows as if they had been consecutive.
- Permit discovery during an active board. Later guesses cannot revoke an already earned discovery.
- Save evidence with the pattern ID, color, row range, column range, and orientation. A saved board snapshot can support a later visual receipt.

The evidence needs a permanent home if collection achievements count distinct shapes across days. Saving only unlocks for individual shapes works for a small catalog, but couples collection rules to reward definitions. A separate version-scoped discovery record keeps recognition independent of rewards.

## Shapes must be attainable with legal words

Synthetic matrices verify recognition, but they cannot establish that a legal game can produce the drawing. Duplicate words are forbidden, and duplicate-letter feedback consumes available letters.

A read-only check against `apps/api/valid-guesses.txt` found the following distinct accepted guesses for the answer `termo`. These demonstrate exact green windows in columns one through three. The masks show the full five-column green projection. A dot means a cell is not green.

| Drawing | Accepted guesses in order                   | Full green masks                            |
| ------- | ------------------------------------------- | ------------------------------------------- |
| T       | `terco`, `aedes`, `aeita`                   | `GGG.G`, `.G...`, `.G...`                   |
| A       | `aedes`, `tarar`, `terco`, `tarau`, `tarbá` | `.G...`, `G.G..`, `GGG.G`, `G.G..`, `G.G..` |
| 0       | `terco`, `tarar`, `tarau`, `tarbá`, `terei` | `GGG.G`, `G.G..`, `G.G..`, `G.G..`, `GGG..` |

The examples prove feasibility for these local green windows only. A second check reproduced all three with the production `computeFeedback()` function, verified distinct normalized guesses against the validation bank, and saved [the evidence](../.audit/wordle-achievements-pattern-evidence.json). The answer `termo` exists in both answer banks. Selection also excludes banned and previously used answers, so this does not prove that `termo` remains available in a future live game. These examples do not establish connected-component isolation, yellow matching, every glyph, or real-world rarity. Each published template needs a reachable example generated with the production feedback function and an answer permitted by the answer bank. Launch verification must distinguish historical source-bank reachability from availability in the remaining live answer pool. Templates without evidence stay out of the launch catalog.

## Achievement opportunities

The following is a candidate pool, not a commitment to publish every item. Names are examples in the game's Portuguese voice. Thresholds and XP require a catalog pass after selecting the scope.

| Family             | Candidate achievements                                                                                                               | Evidence available today                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Tetrominoes        | Individual I, O, T, J, L, S, and Z pieces. Collect all seven.                                                                        | Feedback matrices, plus discovery storage for collections                                     |
| Letters            | Recognize A through Z where templates have reachable examples. Initials and a complete alphabet collection.                          | Feedback matrices. Initials need an explicit user identity source or a player-selected letter |
| Numbers            | Digits 0 through 9. Collect the digits. Recognize a framed 10 or other multi-digit template where width permits.                     | Feedback matrices. Width limits must be validated                                             |
| Shapes             | Square outlines, diamonds, crosses, arrows, hearts, staircases, zigzags, checkerboards, and hourglasses.                             | Feedback matrices                                                                             |
| Symmetry           | Horizontal reflection, vertical reflection, and rotational symmetry on a minimum-size nontrivial window.                             | Feedback matrices. Exclude uniform and empty windows                                          |
| Color              | All-yellow row, all-grey opener, alternating colors, a single green, and rainbow-style rows containing all three feedback states.    | Feedback matrices                                                                             |
| Improvement        | Introduce a new green every guess, move yellows into correct positions, preserve discovered greens, or recover after a blank opener. | Ordered guess history                                                                         |
| Near misses        | A row with exactly one incorrect position, then a solve. Several distinct near misses before solving.                                | Ordered guess history and outcome                                                             |
| Precision          | First solve, two-guess solve, repeated solves within three guesses, and varied exact solve counts.                                   | Attempts and solved state                                                                     |
| Persistence        | Solve after many accepted guesses. Recover after several blank rows.                                                                 | Attempts, feedback, and solved state                                                          |
| Participation      | First played day, total days, consecutive participation, full calendar weeks, and full months.                                       | Dates with accepted guesses                                                                   |
| Winning streaks    | Consecutive solved dates and rebuilding after a broken run.                                                                          | Version-eligible solved dates                                                                 |
| Comebacks          | Return after a gap, solve after an expired unsolved day, and establish a new run after a loss.                                       | Dated outcomes                                                                                |
| Failure            | Acknowledge one expired unsolved day. Recognize a later recovery.                                                                    | Past unsolved sessions. Avoid rewarding repeated deliberate losses                            |
| Elapsed duration   | Multi-guess solves within a short duration or after a long elapsed interval.                                                         | First accepted guess time and solve time. Unknown timestamps remain ineligible                |
| Clock and calendar | Early morning, evening, last minutes before rollover, weekends, and selected calendar dates.                                         | Solve timestamps in the configured game timezone                                              |
| Competition        | First solver on distinct dates and repeated first finishes.                                                                          | Persisted first-solver flag and existing legacy fallback                                      |
| Variety            | Solve both answer lengths, collect different solve-attempt counts, and discover several distinct pattern families.                   | Session history and discovery records                                                         |
| Vocabulary         | Solve words with repeated letters, many vowels, accents, or a palindrome.                                                            | Canonical words. Define normalization and linguistic criteria explicitly                      |
| Collections        | A set of different letters, a set of distinct digits, all tetrominoes, or several shape families.                                    | Distinct version-scoped discoveries                                                           |
| Community          | Collective participation streaks, shared milestone days, and group participation goals.                                              | Guild history. Requires group rules beyond the current per-player evaluator                   |
| Racing             | Win a race, finish close to another player, or perform consistently across races.                                                    | Separate Wordle Race data. Not implied by daily Wordle records                                |

Several ideas need new instrumentation and should not appear as unlockable rules until that exists. These include time between guesses, active thinking time, first-keystroke speed, pauses, deliberate surrender, invalid guess counts, shared-board actions, and use of a specific client. Never infer those events from the current session rows.

Symmetry and complex drawings need a minimum size and more than one foreground distribution. A single green cell is symmetric but is not a useful discovery. Calendar achievements should not assume every month contains the same number of days. Recovery rules should distinguish absence from an expired attempt.

## Start the new collection at zero

The proposed reset uses a persisted achievement version and a stable eligibility boundary. New IDs identify the new rules. Startup, retries, and backfill must never change that boundary.

Lifetime statistics use all game history. Achievement progress, streaks, discoveries, holder percentages, and rewards use only history eligible for the active version. An old best streak must not satisfy a new streak goal.

A clean next-day boundary in the configured game timezone is easiest to explain. Players see the new collection at zero immediately, and eligible games begin at the announced date. A timestamp boundary is an alternative if immediate launch matters. It excludes any session that began before reset, even when solved later. The launch policy needs a decision before implementation.

The reset covers Wordle achievements. It retains sessions, saved boards, lifetime statistics, game streak records, player settings, unrelated achievements, and previously granted XP. XP is shared across features and has no grant ledger that supports a faithful Wordle-only reversal.

Retired definitions must disappear from the generic achievement lists as well as the Wordle collection. Two viable storage strategies are explicit archival with filtering in every achievement reader, or transactional removal of retired Wordle unlocks and definitions. Archival preserves evidence and makes rollback easier. Physical removal is simpler for current readers but is destructive. Neither should happen through an incidental startup upsert.

Reset operations require an inspection mode that reports affected versions, guilds, definitions, unlock counts, and the proposed boundary before mutation. Applying a reset requires a transaction and repeat-safe behavior. This proposal does not apply a reset to any database.

The rollout must block old award writers before activating the reset. An old API process can run the current startup upsert and restore retired catalog definitions. Old evaluation code can also grant retired awards. A persisted version gate or a deployment sequence that stops old writers must cover startup, guesses, and backfill. Physical deletion must remove referencing unlock rows before definition rows because the foreign key does not cascade.

## Keep failures and timing truthful

Derive outcomes as `in_progress`, `solved`, or `expired_unsolved` using the current game date. Do not treat a fixed guess count as failure.

The existing trigger evaluates after an accepted guess. An expired-day achievement can therefore unlock on the next accepted guess or an explicit reconciliation run. Immediate midnight awards would require a new trigger. Read-only collection requests should remain read-only.

Duration descriptions must say that timing approximates the interval after the first accepted guess and can include lock wait. Tight speed thresholds need new timing instrumentation if lock wait would affect fairness. Fast-solve rules need a minimum of two guesses to avoid zero-duration first-guess awards. Long duration includes idle time. Local hour rules use the game timezone and explicit inclusive and exclusive boundaries.

## Reuse and integration

Keep pattern recognition and achievement evaluation in `packages/domain/src/games/wordle/achievements`. Keep history loading, eligibility, persisted discoveries, and rewards in the API service. The API owns canonical guess validation and answer lookup. The domain owns the feedback algorithm, which the API invokes. Both bot and Activity receive the same server decisions.

The Activity collection can retain its existing grouping, progress, rarity, and unlock notifications. New families need Portuguese labels in the Activity locale and bot formatter. Visual evidence previews would need an optional contract addition and rendering in both clients. A catalog-only launch can use the existing payloads, but players would have to infer why a picture achievement unlocked.

Hidden achievements currently conceal names and descriptions but expose IDs. Descriptive IDs can reveal secrets. Decide whether drawings should be visible challenges, secret discoveries, or a mixture before choosing ID and preview behavior.

## Designed workflow and checks

This is a cross-cutting change across the domain, database, API, contracts, Activity, and bot. Verification is strongest around reset and rewards because errors there persist across retries.

1. Confirm pattern semantics, catalog approach, and reset policy. Write and review the final design.
2. Capture the current domain, API achievement, and client test baseline. Add reset checks before changing eligibility.
3. Implement a version boundary and prove that old history contributes to lifetime statistics while every new achievement starts at zero. Repeated startup and backfill must preserve zero eligibility for old boards. Prove that old writers cannot restore or award retired definitions during rollout.
4. Implement template matching with a positive example and negative examples for each template. Prove rotations, prohibited reflections, bounding edges, winning-row exclusion, malformed histories, and duplicate-letter feedback.
5. Publish the curated catalog only after each drawing has a legal-word example. Verify distinct discovery collections, outcomes, date boundaries, minimum attempts, absent timestamps, and reward deduplication.
6. Verify Activity and bot grouping, progress, hidden discoveries, notifications, and any evidence preview. Verify that retired achievements disappear from all readers.
7. Independently review the diff and a reset inspection report. Apply the reset only to the intended database after reviewing that report.

The throughput checkpoint has four implementation units after design approval. Eligibility comes first, followed by pattern recognition, the catalog, and client integration. Each unit ends with observable checks before the next begins.

Done means the active collection starts at zero, old boards cannot re-earn new rewards, real legal boards unlock their intended patterns exactly once, and both clients show consistent progress. Lifetime statistics and unrelated rewards must still match their pre-reset values.
