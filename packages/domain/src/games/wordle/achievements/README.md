# Maintain Wordle achievements

The catalog is authored in `content/` and combined in `catalog.ts`. Each object
contains its ID, Portuguese copy, family, explicit tier, rarity, icon, XP reward,
and pure `evaluate` function. Drawing objects also own their pattern ID, family,
mask, variants, colors, and allowed rotations. `engine/predicates.ts` contains
reusable pure behavior; `engine/history.ts` prepares eligible facts once.

The `wordle_v2_` prefix is part of the established IDs. It is not a runtime
collection version. Existing sessions participate when their date and counters
are eligible. Wordle evaluator functions are source code and are not serialized
into the database.

## Edit one achievement

Find the complete object by ID. For example:

```sh
rg -n "wordle_v2_pattern_tetromino_i" packages/domain/src/games/wordle/achievements/content
```

The object is in `content/patterns/tetrominoes.ts`. Its achievement metadata,
`evaluate: discoveredDrawing`, and `drawing.mask` are together. To change the
silhouette, edit the explicit mask rows there and update the Portuguese
description if it no longer describes the same figure. Keep the ID when the
identity remains the I tetromino.

Run the geometric matcher and production-feedback witness checks:

```sh
bun test packages/domain/src/games/wordle/achievements/engine/matchPatterns.test.ts
bun test packages/domain/src/games/wordle/achievements/legalWitnesses.test.ts
bun apps/api/scripts/verifyWordlePatterns.ts --search-pattern tetromino_i
```

The targeted verifier replaces that pattern's witnesses in
`fixtures/legal-witnesses.json`. Review the changed guesses and feedback, then
run the verifier without `--search-pattern` to check every drawing. Each base
mask and variant needs one legal green and one legal yellow witness produced
through `computeFeedback()`.

## Add a drawing

Add one complete drawing object to its family file, such as
`content/patterns/shapes.ts`. Copy the shape of a nearby entry and give it a new
achievement ID and pattern ID. Keep the mask rows explicit and the allowed
colors and transforms intentional. For example, the essential geometry and
evaluator fields look like this:

```ts
{
  id: 'wordle_v2_pattern_shape_example',
  kind: 'drawing',
  family: 'shapes',
  tier: 17,
  name: 'Exemplo',
  description: 'Forme a figura completa em uma cor.',
  rarity: 'rare',
  icon: '🎨',
  rewardXp: 75,
  hidden: false,
  evaluate: discoveredDrawing,
  drawing: {
    patternId: 'shape_example',
    family: 'shape',
    mask: ['###', '#.#', '###'],
    variants: [],
    colors: ['correct', 'present'],
    rotations: [0],
  },
}
```

Use `#` for required cells and `.` for empty positions. Rows must be rectangular
and no wider than six columns. A drawing is the complete figure in one color:
another same-color cell touching it, including diagonally, changes the figure.
Green and yellow are matched independently. The all-green winning row is
ignored as a neighbor unless the figure itself occupies it. Tetrominoes may
rotate without reflection; letters and digits stay upright.

After adding the object, add legal green and yellow witnesses for its mask and
every variant. `witnessCoverage.ts` checks that the fixture covers both colors
for every authored shape. `matchPatterns.test.ts` exercises the public matcher,
including translations, neighboring cells, winning-row behavior, and
tetromino transforms. Run:

```sh
bun test packages/domain/src/games/wordle/achievements
bun apps/api/scripts/verifyWordlePatterns.ts
```

If witnesses need to be searched from the source word banks, use
`--search-pattern shape_example`, review the fixture diff, and run the full
verifier afterward. The verifier checks source-bank legality, not availability
in a live used-word or banned-word pool.

Collection targets live as explicit objects in `content/collections.ts`. Review
those targets and descriptions when a drawing is added; adding a drawing does
not automatically raise a target.

## Add a reusable rule

Put shared pure behavior in `engine/predicates.ts` only when the helper captures
a meaningful behavior that more than one definition can use. Keep each
achievement's complete identity and `evaluate` function on the object in
`content/`. For example, a history counter could be attached like this:

```ts
// content/gameplay.ts
{
  id: 'wordle_v2_example_goal',
  kind: 'standard',
  family: 'precision',
  tier: 7,
  name: 'Exemplo',
  description: 'Resolva em até três tentativas em dez datas.',
  rarity: 'rare',
  icon: '🏅',
  rewardXp: 75,
  hidden: false,
  evaluate: (facts) => winsWithin(facts, 3, 10),
}
```

Test through the public `analyzeWordleAchievements()` interface, not by
depending on evaluator internals. Cover the threshold boundary, duplicate and
future dates, missing or malformed board evidence when relevant, and capped
progress. Counter results expose progress up to the target; yes-or-no results
use `progress: null`. Board-based rules receive only complete validated
feedback. Malformed boards can retain valid numerical progress, but cannot
provide a drawing or row-based evidence.

There is no Wordle rule registry, rule schema, or exhaustive rule-kind switch.
Do not serialize evaluator functions. Wordle rows in the generic
`achievements` table keep `condition = null`; generic achievement conditions
remain serialized and non-null.

## Seeding and backfill

API startup seeds Wordle metadata from `WORDLE_ACHIEVEMENT_CATALOG` into the
generic `achievements` table. The catalog source remains authoritative for
Wordle presentation and evaluation. Existing eligible sessions participate;
there is no activation boundary or version negotiation. Pattern evidence keeps
the first persisted witness for each player, guild, and pattern ID.

Accepted guesses commit before best-effort achievement awarding. A failed award
does not reject the guess. A later accepted guess or the explicit backfill can
reconcile missed unlocks and XP. `getOverview()` is read-only: it reports
progress and stored evidence but never discovers patterns, unlocks achievements,
or grants XP.

Run an explicit backfill from the repository root when missed awards need to be
reconciled:

```sh
pnpm --filter marquinhos-web-api exec bun scripts/backfillWordleAchievements.ts --guild-id GUILD_ID --batch-size 100
```

Omit `--guild-id` to process every guild. Backfill is repeat-safe: existing
unlock rows and XP are not granted again. See
[`docs/wordle-operations.md`](../../../../../../docs/wordle-operations.md) for
database and test commands.
