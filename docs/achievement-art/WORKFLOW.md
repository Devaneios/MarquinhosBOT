# Achievement art review workflow

This document is the source of truth for reviewing Wordle achievement art with
Codex. The user reviews one badge at a time. A badge is approved only when the
user explicitly approves it.

## Current setup

- [`apps/activity/achievement-art/`](../../apps/activity/achievement-art/) holds
  the renderer, palette, approval record, and `blueprints/<id>.txt` sources.
- The renderer combines the 14×14 blueprint with the palette and achievement
  rarity from the domain catalog.
- `png/<id>.png` contains the 16×16 render, and `sheet.png` is the contact
  sheet. These are review outputs, not approval records.
- `review-status.json` tracks each badge as `pending`, `in_review`, or
  `approved`. Existing renders do not imply approval.
- The Activity `build` and `dev` scripts generate public art from approved
  blueprints. The generated public PNGs are ignored by Git.

See [STYLE.md](STYLE.md) for the pixel format, palette, and visual conventions.

## Review loop

1. Read `review-status.json` and choose the next pending badge in catalog order,
   unless the user names a badge.
2. Show the user the badge's blueprint and current render together. Explain
   briefly what the design appears to represent and how it relates to the
   achievement. Treat existing art as a candidate to keep or refine, not as a
   requirement to redesign. Before proposing or approving a revision, check the
   fixed border and reserved-color rules in `STYLE.md`: the template's geometry
   stays identical, only its rarity color changes, and none of the four rarity
   colors may appear inside the emblem. Inspect the blueprint as well as the
   render; the current parser still accepts those reserved characters.
3. Update only that badge's blueprint based on feedback. Render a native 16×16
   preview with:

   ```sh
   bun apps/activity/achievement-art/render.ts preview docs/achievement-art/review <id>
   ```

   Review at native size; do not upscale the preview for presentation.

   The preview command validates dimensions and known characters; it does not
   enforce border-color exclusivity. Add distinct emblem colors to the shared
   palette, renderer mapping, and style table when the remaining palette is
   insufficient. Prefer the shared shading ramps in `STYLE.md`. After a
   palette change, synchronize the design prompt and run
   `bun apps/activity/achievement-art/render.ts palette` to refresh both palette
   reference images. Inspect the rendered preview before presenting it.
4. Continue the feedback loop on the same badge. Do not start another badge
   until the user explicitly approves the current one.
5. On explicit approval, set that entry to `approved` in `review-status.json`,
   run `bun apps/activity/achievement-art/render.ts build`, and regenerate the normal
   render/contact sheet if useful. Then continue with the next badge. The next
   Activity build or dev start also generates the approved public PNGs.
6. Keep approved status tied to the exact blueprint. If an approved blueprint
   changes later, return its status to `in_review` until the user approves the
   new render.

## Approval and build boundary

The tracked text blueprint is the source. Do not manually copy PNGs into
`apps/activity/public/achievements` or treat a preview as approved. The
renderer’s `build` command uses `review-status.json` as the gate, derives
rarity from the catalog, and emits only approved PNGs. It removes stale
generated PNGs for badges no longer approved. Missing or invalid approved
blueprints fail the command. Pending and in-review art remains available for
local preview without entering public build output.

## Completion

The review is complete when every entry in `review-status.json` is approved and
the build-generated public art matches those approved blueprints. Report any
remaining pending or in-review entries by ID.
