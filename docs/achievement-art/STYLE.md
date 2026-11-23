# Achievement badge art

See [WORKFLOW.md](WORKFLOW.md) for the one-at-a-time review and approval process.

Each Wordle achievement has one 16×16 badge. `render.ts` draws a 1-pixel
rounded ring around the edge. The ring color shows rarity: common gray, rare
blue, epic red, legendary amber. You draw only the 14×14 emblem inside the ring.

## Fixed border and reserved colors

The renderer supplies one shared border template for every badge. Keep its
shape, thickness, corner pattern, and position identical across achievements; only its rarity color changes. Do not draw a replacement border,
extend it with emblem pixels, or edit the template during an individual badge
review. A change to the shared template needs an explicit user request.

All four rarity colors are exclusive to the border, regardless of the badge's
own rarity: `C` (`#818384`), `B` (`#5facfb`), `R` (`#e5484d`), and `O`
(`#ffb000`) must not appear in emblem blueprints, including highlights,
shadows, sparkles, or details. Existing blueprints that use them need review;
the renderer currently accepts these characters, so check this rule manually.

Use the remaining emblem colors first. When they cannot express the design,
add a distinct color with a free character in `render.ts`'s
`CHAR_TO_PALETTE_NAME`, a named RGB entry in `palette.gpl`, and a matching row
in the table below. Do not reuse a reserved hex value under a different
character. Preview the result before approval. Changes to an existing palette
color can affect other badges; review those renders and return affected
approved badges to `in_review`. Keep the design prompt and palette reference
images synchronized as described below.

## Source format

One file per achievement in
[`apps/activity/achievement-art/blueprints/`](../../apps/activity/achievement-art/blueprints/).
The filename uses the catalog ID without the `wordle_v2_` prefix
(`wordle_v2_wins_10` → `wins_10.txt`). The file holds exactly 14 rows of exactly
14 characters. Each character is one pixel:

| Char | Color   | Palette name     | Use                                      |
| ---- | ------- | ---------------- | ---------------------------------------- |
| `.`  | —       | (badge backdrop) | Empty space, renders as `#121213`        |
| `K`  | #121213 | Fundo / Contorno | Cut lines inside a shape                 |
| `A`  | #3a3a3c | Termo Absent     | Gray tiles, dark shading                 |
| `C`  | #818384 | Common           | Border only; forbidden in emblems        |
| `W`  | #e8e8e8 | Texto            | Highlights, paper, text, clock faces     |
| `G`  | #588157 | Termo Correct    | Green tiles, the main brand color        |
| `L`  | #98d68f | Accent Claro     | Light green highlight on green           |
| `Y`  | #c0a054 | Termo Present    | Yellow tiles, gold, bronze medals        |
| `H` | #ffe6a3 | Warm Cream | Gold highlights, parchment, candlelight, sand |
| `S` | #79502e | Brown | Bronze shadows, wood, leather, earth |
| `P` | #9a74d6 | Violet | Gems, flowers, magic, decorative accents |
| `V` | #d9b8f5 | Light Violet | Violet highlights, pale gems, reflected light |
| `D` | #4b346d | Deep Violet | Violet shadows, night scenes, dark fabric |
| `T` | #72d7ce | Light Teal | Water, ice, glass, gems, cool highlights |
| `Q` | #344f36 | Deep Green | Green shadows, foliage, dark green materials |
| `U` | #2f7775 | Deep Teal | Teal shadows, water, glass, ice |
| `N` | #a6a6a8 | Light Gray | Metal, stone, shading below white |
| `F` | #d6432e | Flame Red | Red flames and warm emblem materials |
| `E` | #ff8f70 | Light Coral | Highlights on red flames |
| `M` | #8b2b27 | Deep Red | Shadows on red flames |
| `B`  | #5facfb | Rare             | Border only; forbidden in emblems        |
| `R`  | #e5484d | Epic             | Border only; forbidden in emblems        |
| `O`  | #ffb000 | Legendary        | Border only; forbidden in emblems        |

These additions are part of the shared emblem palette, available to every
badge. Use these light-to-dark ramps as needed:

- Green: `L → G → Q`.
- Red: `E → F → M` (use `Y` or `H` for a warm flame core).
- Gold/brown: `H → Y → S`.
- Violet: `V → P → D` (use `W` sparingly for specular highlights).
- Teal: `W → T → U`.
- Neutral: `W → N → A → K`.

Choose 2 or 3 main colors plus a small highlight or shadow for each emblem;
the larger shared palette is not a requirement to use more colors per badge.
All four border colors remain reserved, including common gray `C`.

`palette.gpl` holds the RGB values; the renderer maps blueprint characters to
its color names. Run `bun apps/activity/achievement-art/render.ts palette` after a
palette change to regenerate `palette.png` (one pixel per entry) and
`palette-preview.png` (16-pixel swatches), both in GPL entry order. These are
palette references; badge review previews remain native 16×16.

The ring covers the emblem's corner pixel at each corner (row 0 col 0, and so on).

## Commands

Run from the repository root.

```sh
bun apps/activity/achievement-art/render.ts preview <dir> <id...>  # validate and write native 16×16 previews to <dir>
bun apps/activity/achievement-art/render.ts render                # validate all, write png/<id>.png and sheet.png
bun apps/activity/achievement-art/render.ts palette               # regenerate palette references from palette.gpl
bun apps/activity/achievement-art/render.ts build                 # write approved badges to apps/activity/public/achievements
bun apps/activity/achievement-art/render.ts scaffold <id...>      # print the tile emblem for a drawing achievement
```

`preview` fails with the row number when a row has the wrong width or an unknown
character. Open the preview image to check the result by eye.

## Look

- At 16×16 every pixel counts. Make one simple, bold silhouette that reads at a
  glance. Fill about 10 to 12 pixels of the 14, centered, and leave the outer
  row and column empty where you can.
- Use 2 or 3 main colors per emblem plus a small highlight or neutral shadow.
  Light comes from the top left. Use `L` on exposed upper edges of green shapes
  and `Q` for green shadows to the lower right; use `A` for neutral shadows.
  Keep shadows inside the margin.
- Use a Wordle tile as the house motif: a solid 2×2 square of `G`, `Y`, or `A`,
  with 1 pixel of gap between tiles. A board row of 5 tiles is 14 pixels wide;
  rows of 4 tiles (11 pixels) leave a margin.
- Within a family, badges share one motif. Rarity sets the border color; emblem detail follows the achievement design.
  Rarity colors stay exclusively on the fixed border.
- Wins use a trophy without a number. Keep the trophy as the emblem across all
  win-count tiers; distinguish tiers with small trophy details rather than
  numerals. Days played use a calendar page; winning streaks use a flame.
  Family progress counts sit underneath in white, with a clear gap above them for families
  that use numerals.
  Collection badges use book covers, a sketchbook, or the
  seven individual tetrominoes. Keep tiny details subordinate to the silhouette.
- Write numbers with the 3×5 font below, 1 pixel apart. Three digits take 11
  pixels, so a number usually replaces part of the motif or sits below a small
  one.

```
0    1    2    3    4    5    6    7    8    9
###  .#.  ###  ###  #.#  ###  ###  ###  ###  ###
#.#  ##.  ..#  ..#  #.#  #..  #..  ..#  #.#  #.#
#.#  .#.  ###  .##  ###  ###  ###  .#.  ###  ###
#.#  .#.  #..  ..#  ..#  ..#  #.#  .#.  #.#  ..#
###  ###  ###  ###  ..#  ###  ###  .#.  ###  ###
```

## Drawing achievements

Letters, digits, tetrominoes, and shapes come from `scaffold`. It lays out the
catalog mask as `G` tiles, with `L` on exposed upper edges and an `A` shadow
to the lower right. The green silhouette preserves the exact catalog mask.
Tiles stay contiguous when the pattern needs more space. Regenerate those
files after a mask changes.
