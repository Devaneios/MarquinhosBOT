# Gameplay badge families

The user explicitly approved all 29 displayed badges across these nine
families together on 2026-11-17. See [`review-status.json`](../../apps/activity/achievement-art/review-status.json) for current approvals.
The user requested one emblem per catalog `family`,
with all families and tiers displayed together before approval.

## Shared rules

Preserve each family's silhouette, size, position, proportions and internal
layout across tiers. No milestone numbers. Use the existing shared palette
and the renderer's unchanged border geometry. All four rarity colors remain
exclusive to the border. Keep 2×2 tiles solid, with no missing corners.

The approved wins, played and streak families are the references for native
16×16 readability and restrained material progression. Their blueprints,
review status and renders are unchanged by this review.

The approved finishes follow the rarity order:
simple, illuminated, polished, gold, violet. Feedback has a sixth tier, which
uses a brighter violet finish with the same geometry. Shorter families use
the beginning of this sequence. Catalog tiers, rarity and achievement content
are unchanged.

## Approved emblems and finishes

| Family | Fixed emblem | Common | Rare | Epic | Legendary | Mythical |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `calendar` | Bound calendar page with six filled 2×2 date cells, completed coverage | Green header and cells | Light green header highlights | | | | |
| `precision` | Bullseye with one-pixel concentric rings, accurate guesses | Red rings | Coral highlights | Two red rings around a centered flame | Gold rings | | |
| `feedback` | Framed 3×3 board of solid 2×2 tiles | Green | One light green tile | Light green upper row and dark green lower row | Gold ramp | Violet ramp | White, light violet and violet rows |
| `style` | Three ascending steps, progress toward the solution | Green | Light green step edges | Dark green risers | | | |
| `speed` | Stopwatch with fixed button, dial and hands | Deep teal | Teal rim highlights | | | | |
| `timing` | Round clock with fixed hands | Neutral metal | White rim highlights | Dark lower rim | Gold | Violet | |
| `variety` | Two overlapping square tiles | Green and teal | | | | | |
| `vocabulary` | Open book with fixed spine and page lines | Green cover | Light green cover highlights | Dark green cover shadows | | | |

## Vocabulary revision

Letra em dobro shows two matching A tiles. Com acento shows a single Á tile.
DEVANEIOS stacks DV over NS with a light upper edge and a darker base.
The three emblems share the green ramp and light lettering used by the
drawing and Wordle tile badges.

## Feedback revision

Each emblem uses five 2×2 Wordle tiles per row. Gray tiles mark absent letters,
yellow tiles mark misplaced letters, and green tiles mark correct letters.
Everything in the Wrong Place shows a single yellow row. The gray and yellow
streaks show their corresponding rows followed by a win. Three Colors in a Row
shows three mixed guesses and a final green row. Anagrams until the End uses
two opposing arrows between a green-and-yellow guess and the winning row.

## Style revision

The style emblems use the same five-tile rows as feedback. Passo a passo
shows one, three, and five green tiles in successive guesses. Faltava uma
shows four greens and one gray above a win. The Por um triz series repeats
the four-green guess on two, three, or four rows.

## Badge order in the review sheet

Rows follow the table above. Columns follow these rarity order, including
achievements declared later in `gameplay.ts`.

- `calendar`: `calendar_week`, `calendar_month`.
- `precision`: `solved_exactly_1`, `solved_exactly_2`, `wins_within_3_10`,
  `solved_exactly_3`, `zero_attempt_solve`.
- `feedback`: `all_yellow`, `blank_opening`, `mixed_rows`,
  `blank_twice_then_solved`, `yellow_only_before_solve`,
  `anagrams_only_before_solve`.
- `style`: `improvement`, `near_miss`, `near_miss_twice`,
  `near_miss_three_times`, `near_miss_four_times`.
- `speed`: `fast_60`, `secret_d6a09c31`.
- `timing`: `midnight`, `morning`, `late`, `first_solver_1`, `first_solver_10`.
- `variety`: `both_lengths`.
- `vocabulary`: `repeated_letters`, `accented_answer`, `devaneios_rows`.

## Review artifacts and approval boundary

Native previews are in `review/gameplay/<id>.png`. The native contact sheet
is `review/gameplay/families.png`, with every badge pasted at exactly 16×16.
`before.png` and `references.png` record the inspected existing art and
approved references. These local review artifacts are ignored by Git and
can be regenerated from the tracked text blueprints with the preview command
in `WORKFLOW.md`.

The initial inspection found reserved border-color characters inside 25 of
the 29 existing gameplay emblems. None remain in the approved blueprints. No palette
additions or changes were needed.

After explicit approval, all 29 statuses were recorded as `approved` and
`bun apps/activity/achievement-art/render.ts build` completed successfully. The normal
renders and contact sheet were regenerated. All 29 generated public PNGs and
tracked PNGs match the displayed native previews byte for byte at 16×16.
The 15 previous approvals and all unrelated source art, statuses, palette,
renderer and PNGs were preserved. The build emitted 44 approved badges total.

Any future blueprint change requires returning the affected badge to
`in_review` and obtaining renewed approval. Apply shared shape corrections
across the entire affected family. Public PNGs are generated by the build,
never copied manually from review artifacts.
