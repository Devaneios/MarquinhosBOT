# Wordle achievements implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace the daily Wordle collection with fresh versioned achievements, including green and yellow subset drawings and durable evidence.

**Architecture:** Preserve the existing award service and derive history goals from eligible sessions. A declarative template registry and pure matcher produce first-discovery evidence. Activation and rewards use database transactions and locks, while both clients consume shared evidence contracts.

**Tech Stack:** TypeScript, Zod, Bun, PostgreSQL 17, Drizzle, React, and the existing bot canvas renderer.

**Spec:** [Approved design](../specs/2026-10-26-wordle-achievements-design.md).

## Global constraints

- Match any subset with fixed geometry. Extra foreground cells never invalidate a drawing.
- Green and yellow are independently valid foreground colors. Include legal yellow witnesses compatible with trying to win.
- Include every accepted row, including the winning row. Preserve tetromino chirality and upright glyphs.
- Target 53 individual patterns and the history and collection goals in the approved spec.
- Existing sessions remain version 1. New sessions take the active version transactionally. Activation is explicit and repeat-safe.
- Archive retired Wordle achievements. Preserve game history, lifetime statistics, unrelated achievements, and existing XP.
- Keep user README changes untouched. Do not activate against a live database or deploy.

## Review focus

- A version change during a guess must not stamp a session ambiguously. Task 4 verifies shared version locks and activation retries.
- Two concurrent final discoveries must not miss a collection reward. Task 4 verifies serialization and exactly-once XP.
- Filtered corrupt rows must not form a false picture. Task 2 rejects the whole matrix and verifies a missing middle row.
- A version-changing delta must not retain retired earned IDs or notifications. Task 5 verifies collection replacement.
- A synthetic silhouette must not be mistaken for legal gameplay. Task 2 verifies real words through production feedback and reports yellow witnesses.

## Architecture decision

Candidate A is the base. The cross-judge independently selected it for preserving current service interfaces and using an advisory award lock rather than an extra lock-row table. Graft candidate B's deterministic witness pipeline and explicit reconciliation recovery. Keep `checkAndAward`, `getOverview`, `getAchievements`, and `backfill`. Avoid a parallel reward coordinator and event counters.

## Task 1. Shared evidence and migration foundation

Files are `packages/contracts/src/wordle.ts`, the HTTP and Activity Wordle schemas, `packages/database/src/schema/wordle.ts`, `packages/database/src/schema/gamification.ts`, and migration `0006_wordle_achievement_versions.sql` with its journal and snapshot.

Interfaces follow.

- `WordlePatternPreview` has `patternId`, `mask: string[]`, `colors: ('correct' | 'present')[]`, and `rotations: (0 | 90 | 180 | 270)[]`.
- `WordlePatternEvidence` has `patternId`, `color`, `origin: [number, number]`, `rotation`, `cells: [number, number][]`, `feedback: LetterFeedback[][]`, and `date`.
- Achievement definitions have optional `patternPreview`. Status and unlocks have optional nullable `matchEvidence`.
- Overview has `achievementVersion`, defaulting to 1 for older payloads. Initialization and guess responses have optional `achievementVersion`. Guess responses can contain the full `achievements` collection to replace cached catalogs across activation.
- Database exports `wordleAchievementVersions` with version, active, and activated_at; `wordlePatternDiscoveries` with the user/guild/version/pattern composite key, session_id, discovered_at, and JSONB evidence. Sessions add `achievement_version`, default 1. Definitions add nullable `wordle_version` and `archived_at`.

- [x] Write contract tests for yellow evidence round trips, out-of-bounds and wrong-color cells, and legacy payloads. Watch the new cases fail.
- [x] Add schemas and migration foundation. Validate coordinates, unique cells, rectangular matrices, and matching foreground.
- [x] Run contract tests, migration tests, and contracts/database typechecks. Expect pass and no automatic version-2 activation.
- [x] Record the checkpoint and commit the foundation.

## Task 2. Pattern registry, matcher, and legal witnesses

Files are new domain `patterns.ts`, `matchPatterns.ts`, their tests, checked-in legal-witness fixtures, and an API script `verifyWordlePatterns.ts` for deterministic witness search and verification.

Interfaces follow.

- `WordlePatternDefinition` extends the preview with `id`, `family`, and Portuguese `name`.
- `WORDLE_PATTERN_CATALOG` contains the 53 approved patterns.
- `matchWordlePatterns(matrix, templates?)` returns the geometric portion of `WordlePatternEvidence`, without feedback/date.
- `parseAchievementMatrix(serializedGuesses, expectedWidth, attempts)` returns a complete feedback matrix or null.
- Pattern IDs use `letter_a`, `digit_0`, `tetromino_i`, and descriptive shape IDs. They are independent of achievement IDs.

- [x] Write failing tests for dense subset matches, yellow matches, winning-row I, required-cell removal, translations, rotations without reflections, and malformed histories.
- [x] Implement the registry and deterministic matching in row/column/color/declared-rotation order. Dots are wildcards.
- [x] Build a rerunnable legal-witness search and verifier using the source banks, distinct canonical guesses, and production feedback. Save inspectable fixtures.
- [x] Run tests and the verifier. Expect every promised template to have a legal witness, including yellow examples. Record exhausted or unavailable live-pool checks separately.
- [x] Record and commit the matcher checkpoint.

## Task 3. Replacement catalog and history rules

Files are domain `rules.ts`, `catalog.ts`, `evaluate.ts`, new `historyFacts.ts`, and their tests. Preserve `stats.ts` lifetime behavior and keep a legacy catalog for pre-activation presentation.

Interfaces follow.

- `AchievementHistoryDay` extends `WordleDayRecord` with `feedback`, `wordLength`, `answerHasRepeatedLetters`, and `answerHasAccent`.
- `WordleEvaluationOptions` retains today/timeZone and adds optional `discoveryIds: ReadonlySet<string>`. No lifetime persisted best streak is supplied to version-2 awards.
- Preserve `evaluateWordleAchievements(days, options)` and existing rule helpers where semantics match. Add `pattern` and `pattern_collection`, plus focused history variants from architecture A.
- Export `WORDLE_ACHIEVEMENT_VERSION = 2`, `WORDLE_ACHIEVEMENT_CATALOG`, and `LEGACY_WORDLE_ACHIEVEMENT_CATALOG`.

- [x] Replace preservation tests with fresh-ID, schema, template coverage, rewards, and hidden-ID checks. Add failing tests for every new history predicate and exact date boundaries.
- [x] Implement the approved catalog, collection goals, and history rules. Keep malformed matrices ineligible for visual rules while numerical counters remain usable.
- [x] Verify current-day unsolved, missing timestamps, completed weeks/months, gap return, both lengths, vocabulary, and first-solver facts.
- [x] Run all domain tests and domain typecheck. Record and commit the checkpoint.

## Task 4. Explicit activation and transactional reconciliation

Files are API `WordleAchievementService.ts`, new `WordleAchievementVersionService.ts`, `gamification/AchievementService.ts`, `wordle.ts`, and new inspection/activation CLI. Update achievement API tests, helpers, and contract tests.

Interfaces follow.

- Version service exports `getActiveWordleAchievementVersion(exec, lock?)`, `syncCompatibleWordleCatalog(exec)`, `inspectWordleAchievementActivation()`, and `activateWordleAchievements()`.
- Preserve current achievement service entry points and add `achievementVersion` and `achievements` to `checkAndAward` results.
- Hold a shared version-row lock during first-session stamping and awards. Activation holds an exclusive lock. Acquire a player/guild/version advisory transaction lock before loading discovery facts.
- Insert discoveries without replacing first evidence. Evaluate all collection rules against the resulting set. Reuse unlock insertion and XP in the same transaction.

- [x] Write failing database tests for zero reset, archival, old-board exclusion, stamp immutability, activation retries, version races, collection races, rollback, and unchanged lifetime statistics/XP.
- [x] Implement activation, compatible startup synchronization, archive filters in all generic readers and awards, session stamping, whole-matrix loading, and version-scoped holder percentages.
- [x] Update old-ID tests to the deliberately new behavior. Keep meaningful generic, concurrency, rollback, and gameplay-availability assertions.
- [x] Run API achievement/contract tests and all affected Wordle tests against the disposable PostgreSQL instance. Verify the CLI inspection is read-only and --apply is explicit.
- [x] Record and commit the checkpoint. Do not apply activation to any existing environment.

## Task 5. Activity and bot evidence

Files are Activity `useWordleBoard.ts`, achievements screens, Portuguese locale, and tests; bot achievement formatter, command, canvas compound, and tests. API adapter initialization spreads the shared versioned overview.

- [x] Write failing client cases for yellow preview/evidence, matched-cell highlights, and a version change clearing retired state and notifications.
- [x] Render pattern previews and earned feedback snapshots from the shared contract. Add family labels. Replace full collection snapshots rather than merging across versions.
- [x] Add compact bot matrix detail through its existing command and renderer, with matched-cell emphasis. Preserve progress and recent-award behavior.
- [x] Run Activity/bot tests and relevant typechecks. Inspect the rendered bot PNG artifact. Skip the Activity browser drive because no browser provider was available and native browser calls timed out. Activity interaction tests and production build pass.
- [x] Record and commit the integration checkpoint.

## Task 6. Whole-change verification and handback

- [x] Update `docs/wordle.md` and `docs/wordle-operations.md` with versioning, subset/yellow semantics, the verification script, inspection, explicit activation, old-writer cutover, and rollout limits.
- [x] Run affected workspace tests, typechecks, lint, builds, and the 53-template legal-witness verifier. Resolve failures before expanding checks further.
- [x] Obtain independent correctness/security and maintainability review, including comment review. Fix material findings and verify their observed behavior.
- [x] Audit the decision trail, reconcile the approved design with final behavior, inspect the diff, and preserve user changes.
- [x] Hand back the implementation and named reset procedure. Report actual tests and any remaining live-environment checks. No deployment, push, or live activation.

Execution uses the already authorized feature scope. The parent owns contracts, migration foundation, and client integration. Independent writers may implement the domain and API seams in separate worktrees after the shared interfaces are committed. Their commits are reviewed and integrated sequentially. No further approval checkpoint is needed for reversible implementation.
