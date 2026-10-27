# Wordle achievements v2 architecture sketch B

This sketch takes the approved spec as fixed. It uses eligible session history as the source for every current progress value. Durable rows record the first pattern witness and each awarded achievement. The API reruns pure evaluation after an accepted guess or explicit reconciliation. It does not maintain event counters or a separate reward coordinator.

## Caller first

```ts
// WordleService.submitGuess, after the guess transaction commits.
if (committedSession.achievementVersion === activeVersion) {
  const result = await wordleAchievements.reconcilePlayer(userId, guildId);
  // Attach result.unlocked, result.progress, result.activeVersion to the reply.
}

// WordleAchievementService.getOverview is read-only.
const overview = await wordleAchievements.getOverview(userId, guildId);
// Both paths compute lifetime stats from all attempted sessions.
```

The existing post-guess best-effort award call and explicit backfill are suitable entry points. A version-1 guess does not invoke v2 reconciliation. An award failure leaves the accepted guess intact, and later reconciliation repairs awards.

## Domain ownership and exact interfaces

Place templates and their launch examples in `packages/domain/src/games/wordle/achievements/templates.ts`, matching in `matcher.ts`, history parsing and facts in `history.ts`, rules in `rules.ts`, and pure evaluation in `evaluate.ts`. Keep `computeFeedback()` in its current domain module.

```ts
type PatternId = string; // Registry validates unique stable IDs.
type Family = 'letters' | 'digits' | 'tetrominoes' | 'shapes';
type Foreground = 'correct' | 'present';
type Cell = Readonly<{ row: number; column: number }>;
type FeedbackMatrix = readonly (readonly LetterFeedback[])[];

interface PatternTemplate {
  id: PatternId;
  family: Family;
  mask: readonly string[];       // '#' is required; '.' is unconstrained.
  transforms: readonly Transform[]; // Glyphs: ['identity']; tetrominoes: rotations only.
  foregrounds: readonly Foreground[]; // Both colors for launch drawings.
}
type Transform = 'identity' | 'rotate90' | 'rotate180' | 'rotate270';

interface PatternEvidence {
  kind: 'pattern';
  patternId: PatternId;
  foreground: Foreground;
  origin: Cell;
  transform: Transform;
  cells: readonly Cell[];
  snapshot: FeedbackMatrix; // No guess or answer words.
}

function parseFeedbackMatrix(rawGuesses: string, attempts: number, width: 5 | 6):
  | { ok: true; matrix: FeedbackMatrix }
  | { ok: false; reason: 'json' | 'row_count' | 'row_width' | 'feedback' };

function discoverPatterns(
  matrix: FeedbackMatrix,
  templates: readonly PatternTemplate[],
): readonly PatternEvidence[];
// One witness per ID, ordered by origin row, origin column, green before
// yellow, then declared transform order. Scan all submitted rows, including
// the winning row. Do not require isolated shapes or constrain '.' cells.

interface AchievementDay {
  sessionId: string;
  date: string;                // Configured game timezone.
  attempts: number;            // Positive accepted guesses only.
  solved: boolean;
  startedAt: number | null;
  solvedAt: number | null;
  firstSolverInGuild: boolean; // API checks all versions for that guild/date.
  answer: { length: 5 | 6; repeatedNormalized: boolean; accented: boolean };
  matrix: FeedbackMatrix | null; // Null if the entire saved matrix is invalid.
}
type DayOutcome = 'solved' | 'in_progress' | 'expired_unsolved';

type HistoryGoal =
  | { kind: 'count'; metric: 'solved_dates' | 'played_dates' |
      'solves_within_three' | 'first_solver_dates'; target: number }
  | { kind: 'streak'; outcome: 'solved' | 'played'; days: number }
  | { kind: 'period'; unit: 'week' | 'month' }
  | { kind: 'attempts'; mode: 'exact' | 'at_least'; count: number;
      target: number }
  | { kind: 'feedback'; condition: 'all_yellow' | 'grey_opening_then_solve' |
      'three_mixed_rows' | 'increasing_greens' | 'near_miss_then_solve' }
  | { kind: 'failure'; condition: 'expired_unsolved' | 'next_day_recovery' }
  | { kind: 'failure'; condition: 'return_after_gap'; gapDays: number }
  | { kind: 'duration'; mode: 'at_most' | 'at_least'; seconds: number;
      minAttempts: number }
  | { kind: 'local_hour'; fromHour: number; toHour: number }
  | { kind: 'answer'; condition: 'both_lengths' |
      'repeated_normalized' | 'accented' };

type Rule =
  | { kind: 'pattern'; patternId: PatternId }
  | { kind: 'collection'; family: Family; distinct: number }
  | { kind: 'history'; goal: HistoryGoal };

interface AchievementDefinition {
  id: `wordle_v2_${string}`;
  family: string;
  tier: number;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  rewardXp: number;
  hidden: boolean;
  rule: Rule;
  templatePreview?: Pick<PatternTemplate, 'mask' | 'transforms'>;
}

type UnlockEvidence =
  | PatternEvidence
  | { kind: 'collection'; patternIds: readonly PatternId[] }
  | { kind: 'history'; goal: HistoryGoal; dates: readonly string[];
      sessionIds: readonly string[]; snapshot?: FeedbackMatrix };

interface RuleResult {
  id: string;
  met: boolean;
  progress: { current: number; target: number } | null;
  evidence: UnlockEvidence | null; // Non-null exactly when met.
}

function evaluateWordleAchievements(input: {
  eligibleDays: readonly AchievementDay[];
  discoveries: ReadonlyMap<PatternId, PatternEvidence>;
  today: string;
  timeZone: string;
  activationAt: number;
  catalog: readonly AchievementDefinition[];
}): readonly RuleResult[];
```

The API computes answer metadata from the canonical daily answer; the domain receives only the booleans it needs. `parseFeedbackMatrix` rejects the whole matrix on any bad row and never drops a row to join neighbors. Numerical session counters remain usable. The evaluator derives `DayOutcome` from solved/date/today. It uses only eligible days for achievement streaks and no persisted lifetime best streak. A completed week or month is eligible only if its first local instant is at or after `activationAt`. Fast solves require two accepted guesses and a nonnegative duration in seconds. A return gap requires an earlier eligible played date. Rule witnesses select the earliest qualifying dates and session IDs in stable order, so retries produce the same evidence.

## Database and transaction ownership

`packages/database/src/schema/wordle.ts` owns `wordle_sessions.achievement_version integer not null default 1`, `wordle_achievement_control` with one active version row, `wordle_achievement_activations(version primary key, activated_at)`, and `wordle_pattern_discoveries`. The discovery primary key is `(user_id, guild_id, version, pattern_id)` and stores `PatternEvidence` as validated JSONB. Add `wordle_achievement_players(user_id, guild_id, version primary key)` only as a row to lock before evaluation. `packages/database/src/schema/gamification.ts` adds `achievements.wordle_version integer null`, `achievements.archived_at bigint null`, and `user_achievements.evidence jsonb null`. Existing Wordle definitions are stamped version 1. Generic definitions retain null version and null archive time. Existing unlocks and XP stay in place.

```ts
interface ReconcileResult {
  activeVersion: number;
  unlocked: readonly WordleUnlockedAchievement[];
  progress: readonly WordleAchievementProgressUpdate[];
  lifetimeStats: WordlePlayerStats;
}

class WordleAchievementService {
  getOverview(userId: string, guildId: string, exec?: DbExecutor):
    Promise<WordleAchievementsOverview>;
  reconcilePlayer(userId: string, guildId: string): Promise<ReconcileResult>;
  backfill(options?: { guildId?: string; batchSize?: number }): Promise<BackfillReport>;
}

function inspectActivation(exec: DbExecutor): Promise<ActivationReport>;
function activateWordleV2(exec: DbExecutor): Promise<ActivationReport>;
```

`submitGuess` reads the active version in its accepted-guess transaction, writes it on session insertion, and never updates an existing session's version. It returns the committed session version to decide whether to reconcile. All historical rows migrate to version 1 by column default and explicit backfill. Do not infer the version from `created_at`.

`reconcilePlayer` runs one transaction in this order: check code catalog version equals the active database version; insert the player lock row if absent and lock it with `FOR UPDATE`; load all attempted sessions for lifetime stats and only active-version sessions for achievement facts; compute first-solver status against all solved guild sessions; parse matrices and discover patterns; conflict-safe insert new discovery rows without replacing first evidence; read the resulting discovery set; evaluate all v2 rules; insert each newly met unlock with evidence; award XP only for the `user_achievements` insert that returns a row. The generic `AchievementService.unlockAchievement` can accept optional validated evidence but must reject archived definitions. The single player lock prevents two concurrent discoveries from each missing a completed collection. A subsequent reconciliation catches a guess committed while the current reconciliation reads history.

`getOverview` reads the active version, its catalog and unlocks, saved discoveries, and active-version sessions without writes. It derives current progress from history and discoveries. It loads all attempted sessions separately for lifetime stats. The holder denominator and numerator both restrict to distinct guild users with accepted guesses in the active version; zero population returns `null`. Generic readers of achievements and user unlocks filter `archived_at IS NULL`; the Wordle reader selects only definitions for the active version.

`activateWordleV2` runs only on explicit `--apply` in the reset tool. Within one transaction it locks the control row, returns the existing activation record if already on 2, archives all version-1 Wordle definitions, inserts the full v2 catalog with `wordle_v2_` IDs, records the activation instant, and changes the active version to 2. `inspectActivation` is the CLI default and reports version, catalog/unlock counts, and version-1 session count without writes. Startup seeds generic definitions but neither activates nor seeds v2. At startup and before awards, code checks catalog version against the control row. If they differ, guesses still work and awards wait. Stop old API and backfill writers before activation; an old binary cannot enforce this boundary.

Persist only the session version, activation instant, catalog archival, first pattern evidence, unlock evidence, unlock rows, and XP. Derive counts, streaks, current progress, outcomes, holder percentages, and lifetime statistics from sessions and discoveries. This avoids dual counters and preserves an audit trail of why an award was granted.

## Contracts and clients

`packages/contracts/src/wordle.ts` validates optional `templatePreview` on a definition and optional `evidence` on an earned status or unlock. For a pattern, validate every evidence coordinate against its snapshot dimensions and the template geometry; old unlock rows may have `evidence: null`. Add required `activeVersion: number` to the achievement overview and Activity `init` payload. Add it to guess results when achievement updates are present. The Activity `useWordleBoard` replaces its achievement collection and clears queued unlocks when the incoming version differs; it applies incremental progress only within the same version. `WordleAchievementsScreen` renders the upright/rotated template preview before discovery and highlights `cells` on the saved feedback snapshot after discovery. The bot's Termo detail path uses the existing image renderer for a compact preview or matched matrix. Both consume the same API decisions and Portuguese catalog metadata.

## Legal witness generation

Keep an offline deterministic witness script beside the domain matcher, not in request handling. For each of the 53 template IDs, enumerate answer candidates from both source answer banks and distinct canonical guesses from `valid-guesses.txt` at the same width. Generate every row with production `computeFeedback(stripDiacritics(guess), stripDiacritics(answer))`, finish with the answer when needed, and pass the resulting matrix through `discoverPatterns`. Prefer a yellow witness when green-only construction would require ignoring known positions. Reject a candidate sequence if it repeats a guess, moves a known green, or violates known yellow letter placement and count constraints. Search must allow more than six guesses. Save one reproducible witness fixture per ID with the answer-bank name, canonical answer, ordered canonical guesses, foreground, and matched coordinates. Report a template as blocked if none exists. A separate deployment inspection filters witness answers through the live used-word and banned-word tables and reports exhausted templates; source-bank reachability alone does not claim live availability.

## Alternative considered

An event-driven reducer could append one progress event after every guess and maintain counters for each rule. It would need replay and correction logic for malformed histories, rollover failures, archive activation, and concurrent collection discoveries. The existing session history already contains the needed facts. Persisting first discoveries and award evidence while deriving progress on read is the smaller design. It also lets reconciliation repair missed post-guess awards without reproducing an event sequence.

## Checks that decide whether the sketch holds

Database tests must prove session stamping, repeat-safe activation, archived generic readers, concurrent collection completion, and one XP grant per unlock. Domain tests must prove subset matching, rotations without reflection, invalid-matrix rejection, and every legal witness through `computeFeedback`. Contract and client tests must prove version cache replacement and evidence bounds. The first implementation checkpoint is the version boundary; do not build awards on an unproven boundary.
