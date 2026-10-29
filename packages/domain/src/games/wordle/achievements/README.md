# Maintain Wordle achievements

Edit achievement objects in `content/`. Keep evaluation algorithms in `engine/`.

## Add or edit an achievement

Choose the list that owns the achievement.

- `content/milestones.ts` contains wins, played days, and winning streak milestones.
- `content/gameplay.ts` contains the other history-based goals.
- `content/collections.ts` contains pattern collection goals with explicit targets.

Open the owning list, change the complete achievement object, and keep its ID stable. For example, changing the annual wins threshold means updating both `count` and the Portuguese description:

```ts
{
  id: 'wordle_v2_wins_365',
  family: 'wins',
  name: 'Ano de respostas',
  description: 'Resolva a palavra diária em 365 datas elegíveis.',
  rarity: 'legendary',
  rewardXp: 750,
  rule: { kind: 'wins', count: 365 },
}
```

Use a new ID for a new challenge. Renaming an ID retires the old entry and creates a separate achievement.

Require an explicit rarity. The catalog supplies XP from rarity unless `rewardXp` overrides it. Hidden status defaults to `false`. Icons use the existing family defaults. Set `hidden`, `icon`, or `rewardXp` only when overriding those defaults.

When changing a threshold, update its Portuguese description in the same object. Existing unlocks and XP remain attached to the ID. Changing a rule does not revoke earned achievements.

Keep the lists in the intended order. The catalog assembles milestones, gameplay goals, drawing achievements, and collections in that order. Each family's encounter order determines its tiers. Inserting, removing, or moving an entry renumbers later tiers in that family.

## Record a catalog revision

Any change to a stored field requires a new catalog revision. Stored fields are the ID, name, description, rarity, icon, rule, and XP. Adding, removing, or editing an achievement or a pattern changes them. When that happens, `catalog.test.ts` fails and prints the next revision number and fingerprint. Set `WORDLE_ACHIEVEMENT_CATALOG_REVISION` in `catalog.ts` to that number. Add the printed line to `fixtures/catalog-revisions.json`.

The database stores the latest synchronized revision. A process with an older revision skips synchronization and logs a warning. During a rolling deploy, it therefore cannot undo the newer catalog.

## Add a drawing

Edit the appropriate list in `content/patterns/`. Each pattern has an ID, family, Portuguese name, and mask. Each mask row appears on its own source line.

```ts
{
  id: 'hourglass',
  family: 'shape',
  name: 'Ampulheta',
  mask: `
    ###
    .#.
    ###
  `,
}
```

Use `#` for the cells of the drawing and `.` for empty cells. Keep every row the same width. Green and yellow match separately. A drawing matches only as the whole group of same-colored cells: any other cell of that color touching it, diagonals included, means the player drew a different figure. The all-green winning row counts as a neighbor only when the drawing itself reaches it. Add wider forms of a drawing with `variants`; each must be distinct, at least as wide as `mask`, at most 5 columns wide, and must not equal any other pattern's figure (the matcher test draws every form and expects only its own pattern).

The pattern source generates its matcher definition, preview, and drawing achievement. Keep pattern IDs stable because saved discoveries reference them. Pattern-family policies supply allowed colors, rotations, achievement family, and rarity. Tetrominoes permit quarter-turn rotations. Other families keep their declared orientation.

For every mask and variant, add one legal green witness and one legal yellow witness to `fixtures/legal-witnesses.json`. The verifier checks this same coverage. Yellow witnesses must preserve previously known green positions and finish with a solve. Keep production-generated feedback as proof that the guess sequence is legal.

Run the verifier to check existing witnesses, or regenerate a single pattern when its mask changes:

```sh
bun apps/api/scripts/verifyWordlePatterns.ts
bun apps/api/scripts/verifyWordlePatterns.ts --search-pattern hourglass
```

Review the targeted fixture diff and run the verifier again without `--search-pattern`. Use `--search` only when intentionally regenerating witnesses for every drawing. Add or change drawings through the public matcher tests, including both colors, exact neighboring cells, translations, rotations, and forbidden reflections.

Collection counts are explicit. Review the applicable collection goals when adding or removing patterns. Do not automatically raise an existing target to match a larger pattern list. Keep targets reachable and update descriptions when intentionally changing them.

## Add a rule kind

1. Add its discriminated schema to `engine/rules.ts`. Keep the inferred rule type as the authority for rule objects.
2. Add its case to the exhaustive switch in `engine/evaluate.ts`.
3. If the rule needs shared evidence, prepare that evidence in `engine/history.ts`.
4. Test it through `evaluateWordleAchievements`: cover threshold boundaries, missing evidence, and capped progress.
5. Add a complete achievement object using the new rule.

Return capped progress for counters and `null` progress for flags. Preserve serialized rule field names for existing kinds. The API stores `JSON.stringify(definition.rule)` as the condition.

Use complete feedback evidence for board-based rules. A malformed matrix must not remove an otherwise valid day from numerical counters. Keep lifetime player statistics separate from the history eligible for the active achievement version.

The engine's public entry point prepares shared history once and returns results in catalog order. Keep rule preparation and individual rule evaluation private; do not add a second evaluator API or a generic rule registry.

## Retire or restore an achievement

Remove the object from its content list. For a drawing achievement, remove its pattern definition and review dependent collections and witnesses.

Record a new catalog revision. On the next API startup, catalog synchronization archives omitted Wordle definitions in the current version. Activation applies the same retirement. Archived definitions disappear from active readers and cannot earn new rewards. Definitions, unlock history, discoveries, and awarded XP remain stored.

Restoring the same ID restores its existing history. Previously earned achievements do not award XP again. Use a new ID when the restored entry represents a different challenge.

Deploying a content edit does not require resetting the achievement version. A deliberate collection reset uses the separate activation procedure.

## Verify an edit

From the repository root, run:

```sh
bun test packages/domain/src/games/wordle
bun apps/api/scripts/verifyWordlePatterns.ts
pnpm --filter @marquinhos/domain typecheck
pnpm --filter @marquinhos/domain lint
```

The pattern verifier reads checked-in witnesses without changing them. Its search options regenerate witness fixtures, so review that diff before keeping it.

Run affected API integration tests when discovery persistence, catalog synchronization, or retirement changes. The API test preload creates and drops a disposable database using `TEST_DATABASE_URL`. Run bot and Activity tests when changing family labels, domain imports, or exported metadata.
