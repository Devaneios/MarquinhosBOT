# Architecture A: retain the award service; make achievement facts versioned

This is a design sketch, not an implementation. It follows the approved design in `docs/superpowers/specs/2026-10-26-wordle-achievements-design.md`. Existing code already separates pure evaluation, transactional awards, and client contracts; keep those boundaries and extend their data.

## Public surface and module ownership

Keep `WordleAchievementService.getOverview`, `getAchievements`, `checkAndAward`, and `backfill` as the application entry points. Preserve `AchievementService.unlockAchievement` and its conflict-safe unlock/XP path. The guess service already commits accepted guesses before its best-effort award transaction; retaining that structure preserves gameplay availability and reconciliation.

Add three focused domain modules beside the existing catalog/evaluator:

- `patterns.ts`: immutable 53-template registry and transformations; no DB or reward knowledge.
- `matchPatterns.ts`: matrix validation and deterministic subset matching.
- `historyFacts.ts`: eligible-date outcomes, calendar coverage, return gaps, durations, answer properties, and feedback predicates. Reuse date helpers from `stats.ts`; never feed persisted lifetime best streak into achievement facts.

Keep `rules.ts`, `catalog.ts`, and `evaluate.ts` as the rule contract, editorial definitions, and evaluator. A separate `WordleAchievementVersionService.ts` owns activation, inspection, and compatible-startup synchronization. Keep discoveries inside `WordleAchievementService`; a second repository/service abstraction is unnecessary at this size.

## Domain data and signatures

```ts
type PatternFamily = 'letters' | 'digits' | 'tetrominoes' | 'shapes';
type Foreground = 'correct' | 'present';
type Rotation = 0 | 90 | 180 | 270;
type Cell = readonly [row: number, column: number];

interface PatternTemplate {
  id: string; // stable pattern identity, separate from achievement identity
  family: PatternFamily;
  mask: readonly string[]; // '#' required, '.' unconstrained
  rotations: readonly Rotation[];
  colors: readonly Foreground[];
}

interface PatternMatch {
  patternId: string;
  color: Foreground;
  origin: Cell;
  rotation: Rotation;
  cells: readonly Cell[]; // absolute snapshot coordinates
}

interface PatternEvidence extends PatternMatch {
  feedback: readonly (readonly LetterFeedback[])[];
  date: string;
}

parseAchievementMatrix(
  serializedGuesses: string,
  expectedWidth: number | null,
  attempts: number,
): FeedbackMatrix | null;

matchWordlePatterns(
  matrix: FeedbackMatrix,
  templates?: readonly PatternTemplate[],
): readonly PatternMatch[];

interface AchievementHistoryDay extends WordleDayRecord {
  feedback: FeedbackMatrix | null;
  wordLength: number | null;
  answerHasRepeatedLetters: boolean | null;
  answerHasAccent: boolean | null;
}

interface WordleAchievementContext {
  today: string;
  timeZone: string;
  discoveryIds: ReadonlySet<string>;
}

evaluateWordleAchievements(
  eligibleDays: readonly AchievementHistoryDay[],
  context: WordleAchievementContext,
  catalog?: readonly WordleAchievementDefinition[],
): WordleAchievementEvaluation[];
```

`WordleDayRecord` and `computeWordlePlayerStats` can remain unchanged for lifetime-stat callers. `AchievementHistoryDay` adds only achievement data to the existing base, minimizing fixture and migration churn. The API history loader returns lifetime days separately from eligible achievement days. Missing answer metadata is unknown, not false. No canonical answer or guess text crosses the evidence contract.

The `FeedbackMatrix` constructor must reject the *whole matrix* on parse error, invalid feedback, unequal widths, expected-width mismatch, or row-count mismatch. Current `readGuesses()` filters invalid rows; replacing that behavior is essential because it can stitch unrelated rows into a new drawing. Numeric counters remain usable when feedback is null.

The matcher searches every row origin, then column origin, then green/yellow, then declared transform order, taking one witness per pattern ID. Check only required cells. Do not inspect wildcard values, components, isolation, or unrelated same-color cells. Include the winning row and every accepted preceding row without padding or omitted rows. Rotations normalize to the top-left bounding box; do not create reflections. Glyphs declare only rotation zero. This directly implements green **or** yellow as independently valid single-color discoveries; it never mixes them.

Precompute transformed required-cell arrays from the static registry, with bounding dimensions, so matching requires bounded loops rather than repeated string transforms. Keep `mask` as the authored source for readable previews; do not maintain a separately edited preview geometry.

## Rule algebra

Extend the existing discriminated union rather than replacing it with an expression language:

```ts
type DrawingRule =
  | { kind: 'pattern'; patternId: string }
  | { kind: 'pattern_collection'; family: PatternFamily; count: number };

type NewHistoryRule =
  | { kind: 'played_streak'; days: number }
  | { kind: 'calendar_coverage'; period: 'week' | 'month' }
  | { kind: 'solved_exactly'; attempts: number }
  | { kind: 'all_yellow_row' }
  | { kind: 'mixed_rows'; consecutive: number }
  | { kind: 'near_miss_solve' }
  | { kind: 'expired_unsolved' }
  | { kind: 'recovery_next_date' }
  | { kind: 'return_after_gap'; absentDays: number }
  | { kind: 'slow_solve'; seconds: number }
  | { kind: 'answer_lengths'; lengths: readonly number[] }
  | { kind: 'attempt_variety'; attempts: readonly number[] }
  | { kind: 'answer_property'; property: 'repeated_letters' | 'accent' };
```

Reuse wins, played, streak, wins-within, solved-after, fast-solve, first-solver, local-hours, and staircase shapes where their meaning is identical. The v2 blank-start rule drops the old five-attempt upper bound. Exactly two guesses must use `solved_exactly`, not the old `solved_within`. Preserve v1 rule definitions only in an immutable legacy catalog if needed for pre-activation presentation; do not continue evaluating v1 for awards.

History facts deduplicate eligible dates and derive unsolved outcomes from `date < today`; current-day unsolved is not failure. Coverage means all dates of an already completed Monday–Sunday week or calendar month exist in eligible played dates. This naturally excludes a period whose required earlier dates were v1, without treating activation-day timestamps as session eligibility. Return gaps require two eligible played dates separated by at least eight day-number units. Elapsed predicates require finite valid timestamps, `solvedAt >= startedAt`, and two guesses for fast awards. First solver must be computed against *all* guild sessions, then attached to eligible sessions.

## Persisted boundary and activation

Add:

```text
wordle_achievement_versions
  version PK, active boolean, activated_at epoch milliseconds
  UNIQUE active WHERE active = true

wordle_sessions
  achievement_version integer NOT NULL DEFAULT 1

achievements
  archived_at nullable epoch milliseconds
  wordle_version nullable integer

wordle_pattern_discoveries
  user_id, guild_id, version, pattern_id  // composite PK
  session_id, discovered_at, evidence jsonb
```

Migration creates active v1 and stamps *every existing session* v1. Prefer preserving the default of 1 as a conservative fallback; the new writer explicitly stamps the current version. Do not let missing application metadata accidentally create v2 eligibility.

```ts
inspectWordleAchievementActivation(targetVersion: 2): Promise<ActivationReport>;
activateWordleAchievements(targetVersion: 2): Promise<ActivationReport>;
syncCompatibleWordleCatalog(exec: DbExecutor): Promise<'ready' | 'waiting'>;
```

The default CLI action is inspection. Apply requires a named explicit option, not an interactive prompt. Inspection reports active/target versions, counts of definitions/unlocks/session versions, and whether already applied. Activation locks the active-version row, archives only Wordle v1 definitions, inserts v2 definitions, marks v1 inactive, and inserts/activates v2 in one transaction. If v2 is already active, return its original record unchanged. A later rollback/re-activation must not clear the existing record or progress. No migration or startup path invokes activation.

The first accepted-guess transaction reads and holds a shared lock on the active-version row while inserting a session with that version. Existing session conflicts never change their stamped version. Activation's exclusive row lock therefore gives a real serialized boundary instead of a timestamp approximation. Avoid creating a versioned session in read-only initialization. Existing zero-attempt v1 sessions stay v1 under the approved immutable-session rule.

New code may synchronize Wordle definitions only when active version equals its supported catalog version. During mismatch, guesses remain playable and awards return a compatible empty delta. Presentation must choose the actual active catalog; do not show the v2 catalog simply because the new binary imports it. Keeping `legacyCatalog.ts` temporarily is the smallest way to preserve v1 display during cutover without expanding the generic DB definition schema with all Wordle presentation fields.

## One transaction for discoveries, collections, and XP

Keep the existing post-guess award transaction. Within `checkAndAward(userId, guildId, tx)`:

1. Read/lock the active version for shared access; return no awards if unsupported. Hold this lock through award commit so activation cannot archive a definition halfway through its award.
2. Acquire a transaction-scoped PostgreSQL advisory lock for `(userId, guildId, version)`, encoded unambiguously (e.g. JSON tuple hashed to the database lock key). Hash collisions only serialize unrelated players. This avoids an extra lock-row table.
3. Load eligible history and saved discoveries under that lock. Load all history separately for lifetime stats; derive global first-solver status before version filtering.
4. Match eligible complete matrices in chronological order. Insert discoveries with conflict-do-nothing; retain the first evidence permanently. Load the resulting discovery set, including inserts from this transaction.
5. Evaluate all individual, collection, and history rules. Call existing conflict-safe `unlockAchievement` for every newly met active definition. XP is granted only for the winning unlock insert and in this transaction.
6. Return version, progress, and earned evidence via the existing notification payload. Reconciliation uses this exact method, not an alternate implementation.

The advisory lock is necessary even with unique pattern/unlock keys: two transactions adding the last two distinct patterns can otherwise both observe an incomplete collection. Lock *before* discovery/history reads. Read-only overview does not acquire the award lock or insert discoveries. It computes pattern progress from durable discoveries, not from newly inferred but unpersisted matches.

## Contracts, caches, and archival

Add optional `patternPreview` to the achievement base schema and optional `matchEvidence` to status/unlocked schemas; old unlock rows without evidence remain valid. Preview contains `patternId`, dimensions/mask, colors, and allowed rotations. Evidence has validated feedback states plus unique, in-bounds matched coordinates; validate that highlighted cells have the declared foreground color. Do not choose a six-row maximum: the game has no attempt cap.

Add `achievementVersion` to overview, initialization, and accepted-guess progress responses. Clients clear cached earned IDs, progress, pending old-version notifications, and detail selections when the version changes, then replace the catalog from an overview/init response. A delta for an unknown/newer version must trigger refresh rather than merging into the old catalog. Keep existing rarity and queued-notification behavior. Activity and bot render the same contract geometry; bot converts it to its existing renderer's input.

Add `archived_at IS NULL` at the shared award lookup and every generic catalog/user-award/recent-award/count reader. The current `AchievementService` readers do not filter anything, so updating only Wordle overview is insufficient. Preserve old unlock rows and all level/XP totals. Restrict holder numerator and denominator to distinct users with accepted guesses in the same guild/current version; empty population returns null.

## Witnesses and review traps

Keep legal-word fixtures outside the production catalog, keyed by pattern ID, with answer and distinct canonical guesses. Tests compute feedback using production `computeFeedback()` and then match the expected pattern. A dedicated witness-search script can generate candidates, but checked-in witnesses must remain inspectable. Include yellow witnesses explicitly, with examples that retain known green positions when continuing toward a solve. Do not accept 53 green-only witnesses as satisfying the user's yellow requirement.

Watch these boundaries during review:

- Never use lifetime `persistedBestStreak` in v2 facts, and never filter first-solver rivals to v2.
- Archive by Wordle ownership/version, not a broad ID prefix that might catch unrelated definitions.
- Do not serialize answer/guess words into detail evidence.
- Historical malformed feedback must not prevent valid numeric history achievements.
- A win guarantees horizontal I; dense subset matches and overlapping identities all award.
- Existing startup `initializeDefaults()` currently publishes the imported Wordle catalog unconditionally; this must be separated before shipping.
- Existing timestamps mix seconds for sessions and milliseconds for unlocks. Name/convert explicitly at contract boundaries.
- Activation inspection is the deliverable; no live activation or deployment is authorized by design approval.

## Structurally distinct alternative rejected

An event-sourced achievement engine could append every accepted guess, project versioned facts/discoveries, and apply rewards through an outbox worker. It would make historical replay and notification retries explicit. Reject it for this rebuild: the repository already has durable sessions, pure history evaluation, and conflict-safe transactional XP, while the new event log would require backfilling/dual-writing all sessions, coordinating a second lifecycle with first-solver decisions, and adding projection lag to both clients. It introduces more migration and operating surfaces without solving a requirement that the existing post-guess transaction plus reconciliation cannot satisfy.

The retained design's limit is full eligible-history reads per evaluation. This is acceptable as a correctness-first extension of the current implementation; measure before introducing incremental materialized counters. The domain interfaces allow that future optimization without exposing storage details to clients.
