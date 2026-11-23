# Drawing and collection badge review

See [`review-status.json`](../../apps/activity/achievement-art/review-status.json) for the current approval status.

The user requested proceeding to the remaining families after approving
all gameplay families. The complete batch is displayed together at native
16×16 in `review/drawings-collections/families.png`. Native individual previews
are in that directory; local review outputs are ignored by Git.

## Drawing families

The 61 drawing achievements enumerate different symbols. Their catalog tiers
are identifiers within each family, rather than progressively higher counts
of the same milestone. Digits represent the drawing itself, not milestone
numbers. The initial candidates enlarged the primary recognition masks. The
user then requested more natural and recognizable artwork, first for nine
icons and subsequently for the other drawing badges.

The current blueprints depict the named symbols directly. They are not
mechanical enlargements of the game recognition masks. Those masks, variants,
achievement text, rarity and ordering remain unchanged. All emblems retain
an empty outer row and column inside the fixed renderer border.

- `letters`: `pattern_letter_a` through `pattern_letter_z`, all 26 letters.
- `digits`: `pattern_digit_0` through `pattern_digit_9`, all ten digits.
- `tetrominoes`: `pattern_tetromino_i`, `pattern_tetromino_o`,
  `pattern_tetromino_t`, `pattern_tetromino_j`, `pattern_tetromino_l`,
  `pattern_tetromino_s`, `pattern_tetromino_z`.
- `shapes`: `pattern_square_outline`, `pattern_diamond_outline`,
  `pattern_cross`, `pattern_heart`, `pattern_arrow_up`, `pattern_arrow_down`,
  `pattern_arrow_left`, `pattern_arrow_right`, `pattern_staircase`,
  `pattern_hourglass`, `pattern_triangle_5`, `pattern_triangle_6`,
  `pattern_staircase_right`, `pattern_staircase_inverted`.
- `gestures`: `pattern_hang_loose`, `pattern_middle_finger`, `pattern_love_you`,
  `pattern_metal_horns`.

The shape collections count drawings in the `shapes` family.

The primary masks, achievement content, rarity and catalog ordering remain
unchanged. The symbol geometry necessarily differs between drawing badges;
the shared visual family comes from centering, clear negative space, the
shared palette and the fixed border.

## Requested shape refinements

The user requested clearer arrows, heart, diamond, hourglass, hang loose and
middle-finger gesture. These nine icons are expressive drawings of their
named symbols rather than literal enlargements of the recognition masks.
This first refinement changed nine blueprints. Their exact revised art was
preserved when the same approach was extended to the other drawings.

- `pattern_arrow_up`, `pattern_arrow_down`, `pattern_arrow_left` and
  `pattern_arrow_right`: one green arrow geometry with a stepped head and a
  four-pixel-wide shaft, rotated by quarter turns for exact family consistency.
- `pattern_heart`: red `F` heart with rounded lobes, a top notch, a tapered
  point and one solid 2×2 coral `E` highlight.
- `pattern_diamond_outline`: continuous green diamond outline with a clear
  interior opening, replacing the four separate blocks.
- `pattern_hourglass`: sloping neutral `N` frame, two caps and gold `Y` sand
  through a narrow neck, replacing the blocky I silhouette.
- `pattern_hang_loose`: warm cream `H` hand with gold `Y` folds and shading;
  the thumb extends diagonally to the side while the little finger points up.
- `pattern_middle_finger`: the same hand palette, with one raised central
  finger, folded knuckles, a side thumb and a narrow wrist.

All colors already belong to the shared emblem palette. Fixed border geometry,
rarity colors and recognition masks are unchanged. Native before-and-after
previews are in `review/shape-refinements/comparison.png`. Individual current
previews in `review/drawings-collections` and its complete contact sheet were
updated to match these nine revisions. The seven collection albums and all
44 approved badges remain unchanged through both refinement rounds.

## Extended drawing refinements

After seeing the nine revised icons, the user requested applying the same
idea to the other drawings. This pass changes the remaining 50 drawing badges
and preserves the nine revised icons and seven collection albums.

- All 26 letters and ten digits share one custom 5×6 pixel font, rendered with
  solid 2×2 light-green `L` cells in a centered 10×12 area. Rounded shoulders,
  open counters and clearer diagonals improve letter and digit recognition.
  The squared zero remains distinguishable from the rounded letter O.
- All seven tetrominoes preserve their exact catalog silhouettes and four
  equal 3×3 units. Each unit has a solid 2×2 upper-left highlight and a darker
  right and bottom edge. There are no gaps or external shadow pixels. Colors
  are shared palette materials: teal I, gold O, violet T, silver J, coral L,
  green S and deep red Z. These are symbol colors, not tier progression.
- `pattern_square_outline` has a larger continuous frame, a clear 8×8 opening
  and a light green upper edge. `pattern_cross` has four equal-width arms and
  a light upper edge. Both retain a green body.
- The three staircase icons share one stepped silhouette, mirrored or flipped
  as named. Neutral `N` stone and white `W` tread edges make the steps clear.
  Lighting stays on exposed upper surfaces after each geometric transform.
- The two triangles taper in five or six two-pixel steps, with respective
  ten- and twelve-pixel bases. Their bodies are green, with a light green
  left face made of complete 2×2 blocks.

Every small font cell, tetromino highlight and triangle highlight is solid.
No new palette entries, detached objects, milestone labels or reserved border
colors are introduced. Before this pass the complete sheet was preserved in
`review/remaining-refinements/before.png`. Current individual previews and
the full native contact sheet remain in `review/drawings-collections`.

## Collection family

Letter and digit collections use closed books with a visible spine and page
edge. The cover marks distinguish the achievements. The two shape collections
share a spiral sketchbook with a square and triangle, with different shading.
The seven tetrominoes use the colors from their individual badges.

| Badge | Emblem |
| --- | --- |
| `letters_5` | Green book with a capital A. |
| `letters_all` | Green book with A–Z on the cover. |
| `digits_5` | Teal book with a large 5. |
| `digits_all` | Teal book with 0–9 on the cover. |
| `tetrominoes_all` | Seven tetrominoes, separated by empty pixels. |
| `shapes_5` | Cream spiral sketchbook with a square and triangle. |
| `shapes_all` | The same sketchbook with a brighter top-left highlight and deeper lower-right shading. |

## Review boundary

Each candidate requires explicit approval.
After approval, record only the approved entries, run the art build and
compare generated PNGs byte for byte with these native previews. Do not copy
review PNGs into the public directory manually.
