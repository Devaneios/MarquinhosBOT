# Wordle achievements design

Status is implemented on the feature branch and verified with workspace tests, typechecks, lint, and builds. The user approved the design and emphasized yellow for drawings that would be impractical during a win-oriented game using greens alone. Activity browser automation and live remaining-answer availability remain unverified. No live activation or deployment has occurred.

## Intent and decisions

Rebuild the daily Wordle achievement collection around pictures in the submitted attempt grid and the ways players participate, solve, persist, fail, and return. Reuse the working game, pure evaluator, transactional XP awards, progress responses, and collection screens.

The user chose a curated achievement catalog with reusable pattern rules. They also chose any matching subset of cells. Extra cells must not invalidate a discovered picture. These are settled product requirements.

This design adds implementation defaults where the user had not expressed a preference. Those defaults include color handling, the winning row, the reset boundary, archival, rewards, and visible discovery previews. The user approved this design and then emphasized yellow discoveries.

## Approaches considered

The existing evaluator could grow bespoke checks for a small fixed list. That would make later letters and shapes harder to add. A reusable template registry fits the requested breadth and is the selected approach. A player-authored challenge editor is outside this rebuild.

For matching, exact rectangular windows and exact connected components would reject extra cells. The user selected matching subsets instead. Whole-board drawing recognition is not required for launch.

## Match any subset while preserving the drawing

A template contains required cells at fixed relative row and column offsets. The matcher slides that geometry across one session's feedback matrix. Every required cell must have the selected feedback color. All other cells are unconstrained.

For example, this T requires five matching cells.

```text
###
.#.
.#.
```

Dots are wildcards. They can contain the same foreground color, another color, or grey. A completely green three-by-three area contains this T and must match it. Its extra greens are allowed by the selected semantics.

The matcher follows these rules.

- Use every real accepted row, including the final winning row. No rows are invented or padded.
- Keep row and column spacing intact. Do not skip intervening rows, stretch a glyph, or scale a shape.
- Search green and yellow separately. Either color earns the same shape discovery. The launch templates do not use grey as foreground or combine green and yellow into one foreground color.
- Treat yellow as a first-class drawing color, not a fallback. Verify legal yellow witnesses and select examples that remain compatible with trying to solve the puzzle. Do not require players to discard known green positions merely to obtain the catalog's only drawing examples.
- Allow translation for every template. Allow rotations for tetrominoes. Do not reflect tetrominoes, so J and L remain distinct and S and Z remain distinct.
- Keep letters and digits upright. Each template declares its allowed transforms.
- Do not require isolated components. Touching foreground cells are allowed.
- Discover shapes during play, on the winning guess, and during reconciliation of eligible histories. A later guess cannot revoke a discovery.
- Grant every newly met achievement, even when several match on the same board. Queue notifications through the existing client mechanism.
- Count a pattern ID once per player, guild, and achievement version. Color, position, orientation, and rediscovery on another date do not create extra collection progress or XP.

The horizontal I tetromino is four adjacent foreground cells. Because the winning row is eligible, a win on a five-letter or six-letter board guarantees I. A filled area may also earn O, T, letters, or digits. These outcomes are intentional. Rarity and XP must reflect ease rather than treating dense subset matches as rare drawings.

There is no ranking between overlapping patterns. For example, a dense digit 8 may also contain other digit templates. Award every matching ID. Templates that have identical required geometry under their allowed transforms remain separate discoveries only when their catalog identities are deliberately different, such as a glyph and a tetromino.

## Represent patterns and evidence as domain data

The domain owns a template registry. Each entry defines a stable pattern ID, family, required mask, allowed transforms, and allowed foreground colors. Use discriminated rule variants for single-pattern discovery, distinct-pattern collections, and game-history goals.

The pure matcher consumes a validated feedback matrix and templates. It returns discoveries with the pattern ID, foreground color, origin, transform, and exact matched cell coordinates. It does not read the database or grant XP.

For each pattern, return one deterministic witness. Order candidate witnesses by row origin, column origin, green before yellow, and the template's declared transform order. Save the first discovery. Later matches leave its evidence unchanged.

Preserve the submitted matrix when validating history. Reject matrix evidence if parsing fails, a row has an invalid feedback value, row widths differ from the daily answer width, or the row count differs from attempts. Never silently remove an invalid row and join its neighbors into a new picture. Numerical statistics can still use valid session counters without treating the matrix as complete evidence.

Keep snapshot evidence containing feedback states and matched coordinates, without answer text or guess words. The detail view can highlight the matching cells even if later maintenance changes a saved game. The schema validates bounded coordinates against the snapshot.

## Launch catalog

The shape registry targets the following complete sets.

| Set          | Individual discoveries                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Letters      | A through Z, using consistent upright block glyphs                                                                 |
| Digits       | 0 through 9, using consistent upright block glyphs                                                                 |
| Tetrominoes  | I, O, T, J, L, S, Z                                                                                                |
| Other shapes | Square outline, diamond outline, cross, heart, up arrow, down arrow, left arrow, right arrow, staircase, hourglass |

Every template must fit a supported board width and have a distinct-legal-guess example generated through production `computeFeedback()`. Prefer three-column glyphs so both answer widths can produce them. Larger drawings can use five columns and either supported answer width. They can require more than six attempts because the daily game has no attempt cap.

The launch contains 53 individual patterns. Checked-in fixtures and the rerunnable `verifyWordlePatterns.ts` script prove all 53 separately in both green and yellow through the production feedback algorithm and default subset matcher. Yellow witnesses preserve previously known green positions and finish with a solve. Live remaining-answer availability still requires inspection against the deployment database.

Reachability means an example from the source answer banks, not a promise that its answer remains unused or unbanned in the live database. Also check the remaining answer pool before deployment and report templates whose witnesses are exhausted. If a required template cannot be realized with legal words, report the blocking template and evidence. Do not silently replace its silhouette or omit it from the promised set.

Collection goals count distinct pattern IDs. Launch collections cover five letters, the full alphabet, five digits, all digits, all seven tetrominoes, five other shapes, and all ten other shapes. A single board may advance several collections.

The history-based catalog uses these launch goals.

| Family                | Goals                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Wins                  | 1, 10, 50, 100, and 365 eligible solved dates                                                                                           |
| Participation         | 1, 7, 30, 100, and 365 eligible played dates                                                                                            |
| Winning streaks       | 3, 7, 14, 30, and 100 consecutive solved dates                                                                                          |
| Participation streaks | 7 and 30 consecutive played dates, regardless of outcome                                                                                |
| Calendar coverage     | Every date in a completed Monday-through-Sunday week. Every date in a completed calendar month                                          |
| Precision             | A first-guess solve. A solve in exactly two guesses. Ten solves within three guesses                                                    |
| Persistence           | Solve after at least 10 guesses. Solve after at least 20 guesses                                                                        |
| Feedback              | An all-yellow row. An all-grey opening row followed by a solve. Three consecutive pre-solve rows containing all three feedback states   |
| Improvement           | A solve with at least three guesses and strictly increasing green counts. A solve after a near miss with exactly one non-green position |
| Failure and recovery  | One expired unsolved attempted date. Solve on the date immediately following an expired unsolved attempted date                         |
| Return                | Play after at least seven intervening dates without an eligible accepted guess                                                          |
| Elapsed time          | Solve within 60 seconds and within 30 seconds, each with at least two accepted guesses. Solve after at least one hour of elapsed time   |
| Local clock           | Solve between 00:00 and 01:00, between 05:00 and 08:00, or between 22:00 and midnight                                                   |
| First solver          | Be the guild's first solver on 1 and 10 eligible dates                                                                                  |
| Variety               | Solve both answer lengths. Solve with each exact attempt count from 1 through 6                                                         |
| Vocabulary            | Solve an answer containing repeated normalized letters. Solve an accented canonical answer                                              |

This is the initial release scope. The [discovery proposal](../../wordle-achievements-rebuild.md) records further opportunities. Community goals, racing, user initials, custom templates, active thinking time, pauses, rejected guesses, and deliberate surrender are outside this release. They need additional rules or instrumentation.

Use new Portuguese names and descriptions. Do not preserve old achievement IDs merely to satisfy the current catalog tests. New IDs begin with `wordle_v2_` and never reuse the identity of a retired rule.

All launch drawings are visible challenges with a template preview. Recovery and unusual elapsed-time achievements can be hidden, using opaque IDs for hidden entries so their IDs do not reveal the condition. Preserve existing hidden-metadata behavior elsewhere.

Launch rarity is an editorial estimate, not a measured probability. Common, rare, epic, and legendary rewards use 25, 75, 150, and 300 XP respectively. Completion of the full alphabet or all 365-day milestones can grant 750 XP. Tier rewards never decrease as a goal becomes harder. I is common. During implementation, choose the remaining classifications based on the legal examples and document those choices in the catalog.

## Start the active collection at zero

Introduce a persisted Wordle achievement version. Version 1 represents all existing sessions and definitions. Version 2 represents this rebuild. The active version changes through an explicit, repeat-safe activation transaction.

Stamp existing Wordle sessions as version 1. On creation, new API code stamps a session with the active version inside the same transaction that accepts its first guess. An existing session keeps its original version even if it is solved after activation. Do not infer eligibility from a rounded creation timestamp or change a version during backfill.

This session-level boundary is the proposed implementation default. Activation immediately shows the new catalog at zero. Sessions created after activation count toward it. A board started before activation remains playable but contributes only to lifetime statistics. No new-version award is inferred from its old or later rows.

The activation transaction establishes the active version, archives the old Wordle definitions, and seeds the new catalog. Retain old definitions and unlock rows for audit and rollback. Exclude archived entries from generic and Wordle-specific collection lists, earned totals, recent awards, and future award attempts. Achievements unrelated to Wordle remain active.

Keep saved games, daily answers, lifetime statistics, game streak records, settings, and all previously granted XP. The new collection's progress and achievement streaks use only version-2 sessions. Lifetime best streak is never an input to version-2 achievement streak rules.

Holder percentages use distinct users with accepted guesses in the active version within the guild. Return null when that population is empty. Holder counts must be limited to the same eligible population.

Add durable discovery storage keyed by user, guild, version, and pattern ID. In one award transaction, insert new discoveries, evaluate individual and collection rules from the resulting discovery set, insert new unlocks, and grant XP only for newly inserted unlocks. Serialize discovery and collection evaluation within the same player, guild, and version so concurrent discoveries cannot each miss the other's contribution to a completed collection. Uniqueness constraints and conflict-safe inserts protect concurrent requests and retries.

The reset tool defaults to inspection. It reports the current and proposed versions, affected catalog entries and unlock counts, and how existing sessions remain in version 1. Applying activation requires an explicit action. Repeating an applied activation preserves its original activation record and never resets version-2 progress.

Stop old API processes and old backfill workers before activation. Old binaries do not know the version or archival rules and cannot be trusted to honor a new code-level check. Startup in new code checks that its catalog version matches the active version before attempting awards. Startup synchronization neither activates a version nor publishes its definitions before activation. When the code and active version differ during cutover, guesses remain playable but achievement awards wait until compatible activation. The deployment procedure must verify that only compatible writers restart. No production activation or deployment is part of design approval.

## Define outcomes and duration truthfully

Derive a played session as solved when its solved flag is true. Otherwise it is in progress when its date is today and expired unsolved when its date precedes today. A missing date is absence, not failure. A failure achievement grants once and does not scale rewards with deliberate losses.

Evaluate achievements after accepted guesses and through the existing explicit backfill or reconciliation path. An expired-day achievement becomes awardable after rollover and unlocks on the next accepted guess or reconciliation. Overview requests remain read-only. Immediate midnight notifications are not required.

All consecutive-date and calendar goals use the configured game timezone. A coverage goal needs the whole period to be eligible for version 2. A month containing activation before its first eligible date cannot count as complete. Return-after-gap rules require an earlier eligible played date and do not treat a new player as returning.

Elapsed duration uses the existing session timestamps in seconds and includes idle time and possible transaction lock wait. It approximates time after the first accepted guess. Reject missing, negative, or reversed intervals. Use two guesses as the minimum for fast solves. This release does not claim to measure active thinking time.

## Reuse the application boundaries

The domain owns feedback, shape geometry, the template registry, rule schemas, and pure evaluation. The API owns canonical guesses, answer lookup, persisted versions, discoveries, unlocks, and rewards. It produces the same decisions for bot and Activity.

Keep lifetime statistics and current-version achievement facts separate in the API service. Backfill loads only the appropriate sessions for discovery and awards while retaining complete lifetime history for statistics. First-solver status keeps its existing guild-day meaning. A version-1 player who already solved that day's word remains the first solver even if another player's version-2 session finishes later.

Extend achievement payloads with optional template preview and earned match evidence. Validate additions in shared contracts before rendering. Preserve existing fields and old rows without evidence. Progress refreshes must replace or invalidate cached collection data when the active version changes. Include the active version in the overview and initialization payload so both clients can discard retired unlocks and progress.

The Activity detail view shows the required template before discovery and highlights matched cells on the saved feedback snapshot after discovery. The bot includes a compact pattern or highlighted matrix in its achievement detail output using its existing image renderer. Both clients keep their existing rarity, progress, and notification behavior. Add family labels and keep displayed text in Portuguese.

## Verification and completion

Build the verification around the following observable behaviors.

1. The new catalog is visible with zero earned items and zero progress after activation, while lifetime statistics and XP match their prior values.
2. A guess on a version-1 board and a full backfill cannot earn version-2 discoveries or rewards. New sessions can earn them.
3. Repeated activation, startup, reconciliation, and concurrent guesses do not change the boundary or duplicate discoveries, unlocks, or XP.
4. A dense foreground rectangle matches every contained subset template. Extra cells and adjacent cells never invalidate a subset match.
5. Removing a required cell prevents that witness. Moving it to a different relative offset cannot satisfy the original witness. Other valid witnesses may still match.
6. Tetromino rotations work without automatic reflections. Glyph orientation is preserved. Real widths, all board edges, short boards, winning rows, malformed histories, and duplicate-letter feedback are covered.
7. Every launch pattern has a legal-word witness through the production feedback function. Verify overlapping patterns and multiple discoveries from one board.
8. Collection progress deduplicates across colors, positions, dates, orientations, retries, and backfill.
9. Current-day unsolved sessions never count as failures. Date boundaries, calendar coverage, return gaps, unknown timestamps, first-solver eligibility, and both answer lengths obey this design.
10. Generic and Wordle-specific collection readers hide archived entries. Both clients clear old cached collection state on a version change and show matching previews and evidence.

Run domain tests, database-backed API and contract tests, Activity and bot tests, relevant typechecks, and lint. Drive both changed client views before claiming end-to-end completion. An independent review checks reset isolation, concurrency, the legal examples, and subset semantics.

The implementation has four verification checkpoints. First establish the version boundary and retirement rules. Then implement the pure matcher and legal examples. Next replace the catalog and connect discoveries to awards. Finally connect evidence and version changes to both clients. Verify each before the next unit.

Product implementation is complete when all checks pass and the reset inspection report is reviewable. Applying activation to a live database is a separate operational action against a named environment.
