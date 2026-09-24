import type {
  BoardView,
  ShipPlacement,
  ShotView,
} from '@marquinhos/contracts/activity/games/battleship';
import { BOARD_SIZE } from '@marquinhos/domain/games/battleship/BattleshipEngine';
import { cellsFor } from '@marquinhos/domain/games/battleship/placement';
import { Container, Graphics, Text, type FederatedPointerEvent } from 'pixi.js';

export type CanvasMode = 'placement' | 'battle' | 'spectate';
export type BoardSlot = 'own' | 'opponent';
export type ActiveBoard = BoardSlot | 'none';
export type MotionPreference = 'full' | 'reduced';
export type Cell = { x: number; y: number };

const MIN_CELL = 20;
const MAX_CELL = 40;
// Below this, two boards side by side get too cramped to tap on a phone, so
// they stack instead.
const SIDE_BY_SIDE_MIN_CELL = 26;
const BOARD_GAP = 28;
const EDGE_PAD = 6;
const GUTTER_RATIO = 0.75;
const TITLE_RATIO = 1.15;
const COLUMN_LABELS = 'ABCDEFGHIJ';

const PANEL = 0x1c1e22;
const BORDER = 0x3a3d44;
const ACCENT = 0xffb000;
const TEXT_DIM = 0x8f939b;
const TEXT_LABEL = 0x5f7d91;
const WATER_DEEP = 0x071b29;
const WATER = 0x0c2a3e;
const GRID_LINE = 0x2a5670;
const WAVE = 0x4c8fb3;
const HULL = 0x8d99a6;
const HULL_EDGE = 0xc3ccd6;
const DECK = 0x6b7682;
const TURRET = 0x3e4750;
const REVEALED_HULL = 0x6e5a8a;
const SUNK_HULL = 0x5a2027;
const SUNK_EDGE = 0xb33a48;
const PREVIEW_OK = 0x5fbf77;
const PREVIEW_BAD = 0xe0505a;
const HIT_GLOW = 0xff4d2e;
const HIT_FLAME = 0xff7a2f;
const HIT_CORE = 0xffd36b;
const MISS = 0xdbe8f2;
const RETICLE = 0xffb000;
const FONT = 'ui-monospace, "SF Mono", "Cascadia Code", monospace';

const WAVE_ROWS_PER_CELL = 1;
const WAVE_SEGMENTS = 24;
const WAVE_SPEED = 0.0009;
const HIT_PULSE_SPEED = 0.005;
const ACTIVE_PULSE_SPEED = 0.003;
const BURST_MS = 650;
const RIPPLE_MS = 900;
const FLASH_MS = 260;

export interface BoardBlock {
  x: number;
  y: number;
  gridX: number;
  gridY: number;
}

export interface CanvasLayout {
  cell: number;
  gutter: number;
  titleBand: number;
  arrangement: 'row' | 'column';
  blocks: BoardBlock[];
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function blockSize(cell: number) {
  const gutter = Math.round(cell * GUTTER_RATIO);
  const titleBand = Math.round(cell * TITLE_RATIO);
  return {
    gutter,
    titleBand,
    width: gutter + cell * BOARD_SIZE + EDGE_PAD * 2,
    height: titleBand + gutter + cell * BOARD_SIZE + EDGE_PAD * 2,
  };
}

// Width units one board block consumes per pixel of cell size — lets the
// cell size be solved directly from the available width.
const BLOCK_UNITS = GUTTER_RATIO + BOARD_SIZE;

export function boardCountFor(mode: CanvasMode): number {
  return mode === 'battle' ? 2 : 1;
}

export function computeLayout(
  availableWidth: number,
  boardCount: number,
): CanvasLayout {
  const usable = Math.max(0, availableWidth - EDGE_PAD * 2 * boardCount);
  const sideBySideCell = Math.floor(
    (usable - BOARD_GAP * (boardCount - 1)) / (BLOCK_UNITS * boardCount),
  );
  const arrangement =
    boardCount > 1 && sideBySideCell < SIDE_BY_SIDE_MIN_CELL ? 'column' : 'row';
  const rawCell =
    arrangement === 'row'
      ? sideBySideCell
      : Math.floor((availableWidth - EDGE_PAD * 2) / BLOCK_UNITS);
  const cell = clamp(rawCell, MIN_CELL, MAX_CELL);
  const size = blockSize(cell);

  const blocks: BoardBlock[] = [];
  for (let i = 0; i < boardCount; i++) {
    const x = arrangement === 'row' ? i * (size.width + BOARD_GAP) : 0;
    const y = arrangement === 'column' ? i * (size.height + BOARD_GAP) : 0;
    blocks.push({
      x,
      y,
      gridX: x + EDGE_PAD + size.gutter,
      gridY: y + EDGE_PAD + size.titleBand + size.gutter,
    });
  }

  const count = boardCount;
  return {
    cell,
    gutter: size.gutter,
    titleBand: size.titleBand,
    arrangement,
    blocks,
    width:
      arrangement === 'row'
        ? size.width * count + BOARD_GAP * (count - 1)
        : size.width,
    height:
      arrangement === 'column'
        ? size.height * count + BOARD_GAP * (count - 1)
        : size.height,
  };
}

export function cellAt(
  localX: number,
  localY: number,
  cell: number,
): Cell | null {
  const x = Math.floor(localX / cell);
  const y = Math.floor(localY / cell);
  if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return null;
  return { x, y };
}

export interface Hull {
  x: number;
  y: number;
  length: number;
  orientation: 'horizontal' | 'vertical';
}

export function hullFor(cells: Cell[]): Hull | null {
  if (cells.length === 0) return null;
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX + 1;
  const spanY = Math.max(...ys) - minY + 1;
  return spanY > spanX
    ? { x: minX, y: minY, length: spanY, orientation: 'vertical' }
    : { x: minX, y: minY, length: spanX, orientation: 'horizontal' };
}

export function shotKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

// Returns shots not yet in `seen` and records them there, so each shot
// animates exactly once no matter how many state messages repeat it.
export function takeNewShots(seen: Set<string>, shots: ShotView[]): ShotView[] {
  const fresh = shots.filter((shot) => !seen.has(shotKey(shot)));
  for (const shot of fresh) seen.add(shotKey(shot));
  return fresh;
}

export function isInsideGrid(cell: Cell): boolean {
  return (
    cell.x >= 0 && cell.x < BOARD_SIZE && cell.y >= 0 && cell.y < BOARD_SIZE
  );
}

export interface BoardInput {
  board: BoardView;
  title: string;
  active: boolean;
  pendingShips: ShipPlacement[];
  previewCells: Cell[];
  previewValid: boolean;
  canFire: boolean;
}

export interface BoardHandlers {
  onHover?: (cell: Cell | null) => void;
  onTap?: (cell: Cell) => void;
}

type Effect = { kind: 'burst' | 'ripple'; cell: Cell; start: number };

// Draws a hull as a tapered polygon along its length. `along`/`across` are
// mapped to x/y by orientation so one code path handles both directions.
function drawHull(
  g: Graphics,
  hull: Hull,
  cell: number,
  style: { fill: number; alpha: number; edge: number; details: boolean },
) {
  const inset = cell * 0.12;
  const a0 = inset;
  const a1 = hull.length * cell - inset;
  const b0 = inset * 1.1;
  const b1 = cell - inset * 1.1;
  const mid = (b0 + b1) / 2;
  const beam = b1 - b0;
  const chamfer = beam * 0.28;
  const bow = Math.min(beam * 0.75, (a1 - a0) * 0.45);
  const baseX = hull.x * cell;
  const baseY = hull.y * cell;
  const map = (a: number, b: number): [number, number] =>
    hull.orientation === 'horizontal'
      ? [baseX + a, baseY + b]
      : [baseX + b, baseY + a];

  const outline = [
    map(a0 + chamfer, b0),
    map(a1 - bow, b0),
    map(a1, mid),
    map(a1 - bow, b1),
    map(a0 + chamfer, b1),
    map(a0, b1 - chamfer),
    map(a0, b0 + chamfer),
  ].flat();
  g.poly(outline)
    .fill({ color: style.fill, alpha: style.alpha })
    .stroke({
      width: Math.max(1, cell * 0.05),
      color: style.edge,
      alpha: style.alpha,
    });

  if (!style.details) return;

  const deckInset = beam * 0.3;
  const [dx0, dy0] = map(a0 + chamfer, b0 + deckInset);
  const [dx1, dy1] = map(a1 - bow, b1 - deckInset);
  g.roundRect(
    Math.min(dx0, dx1),
    Math.min(dy0, dy1),
    Math.abs(dx1 - dx0),
    Math.abs(dy1 - dy0),
    beam * 0.12,
  ).fill({ color: DECK, alpha: style.alpha });

  // One turret per interior cell; the bow cell stays clean so the taper reads.
  for (let i = 0; i < hull.length - 1; i++) {
    const [tx, ty] = map(i * cell + cell / 2, mid);
    g.circle(tx, ty, beam * 0.2).fill({ color: TURRET, alpha: style.alpha });
    g.circle(tx, ty, beam * 0.08).fill({
      color: HULL_EDGE,
      alpha: style.alpha * 0.6,
    });
  }
}

function drawSunkMarks(g: Graphics, cells: Cell[], cell: number) {
  const pad = cell * 0.24;
  for (const c of cells) {
    const x = c.x * cell;
    const y = c.y * cell;
    g.moveTo(x + pad, y + pad)
      .lineTo(x + cell - pad, y + cell - pad)
      .moveTo(x + cell - pad, y + pad)
      .lineTo(x + pad, y + cell - pad);
  }
  g.stroke({
    width: Math.max(1.5, cell * 0.07),
    color: SUNK_EDGE,
    alpha: 0.85,
  });
}

class BoardRenderer {
  readonly root = new Container();
  private readonly frame = new Graphics();
  private readonly water = new Graphics();
  private readonly waves = new Graphics();
  private readonly grid = new Graphics();
  private readonly ships = new Graphics();
  private readonly hitGlow = new Graphics();
  private readonly markers = new Graphics();
  private readonly hover = new Graphics();
  private readonly fx = new Graphics();
  private readonly flash = new Graphics();
  private readonly hitBox = new Graphics();
  private readonly gridLayer = new Container();
  private readonly title: Text;
  private readonly effects: Effect[] = [];
  private flashStart = -Infinity;
  private hoverCell: Cell | null = null;
  private input: BoardInput | null = null;
  private readonly boardPx: number;
  private readonly layout: CanvasLayout;
  private readonly slot: BoardSlot;
  private readonly handlers: BoardHandlers;
  private readonly motion: MotionPreference;

  constructor(
    layout: CanvasLayout,
    block: BoardBlock,
    slot: BoardSlot,
    handlers: BoardHandlers,
    motion: MotionPreference,
  ) {
    this.layout = layout;
    this.slot = slot;
    this.handlers = handlers;
    this.motion = motion;
    const { cell, gutter, titleBand } = layout;
    this.boardPx = cell * BOARD_SIZE;
    this.root.position.set(block.x, block.y);

    const frameW = gutter + this.boardPx + EDGE_PAD * 2;
    const frameH = titleBand + gutter + this.boardPx + EDGE_PAD * 2;
    this.frame.roundRect(0, 0, frameW, frameH, cell * 0.3).fill(PANEL);

    this.title = new Text({
      text: '',
      style: {
        fontFamily: FONT,
        fontSize: Math.round(cell * 0.42),
        fontWeight: 'bold',
        letterSpacing: 2,
        fill: TEXT_DIM,
      },
    });
    this.title.anchor.set(0, 0.5);
    this.title.position.set(EDGE_PAD + gutter, EDGE_PAD + titleBand / 2);

    const labels = new Container();
    const labelStyle = {
      fontFamily: FONT,
      fontSize: Math.round(cell * 0.36),
      fill: TEXT_LABEL,
    };
    for (let i = 0; i < BOARD_SIZE; i++) {
      const col = new Text({ text: COLUMN_LABELS[i] ?? '', style: labelStyle });
      col.anchor.set(0.5);
      col.position.set(
        EDGE_PAD + gutter + i * cell + cell / 2,
        EDGE_PAD + titleBand + gutter / 2,
      );
      const row = new Text({ text: String(i + 1), style: labelStyle });
      row.anchor.set(0.5);
      row.position.set(
        EDGE_PAD + gutter / 2,
        EDGE_PAD + titleBand + gutter + i * cell + cell / 2,
      );
      labels.addChild(col, row);
    }

    this.gridLayer.position.set(block.gridX - block.x, block.gridY - block.y);
    this.drawWater();
    this.drawGrid();
    this.drawWaves(0);

    const waterMask = new Graphics()
      .roundRect(0, 0, this.boardPx, this.boardPx, cell * 0.15)
      .fill(0xffffff);
    this.waves.mask = waterMask;

    this.hitBox
      .rect(0, 0, this.boardPx, this.boardPx)
      .fill({ color: 0, alpha: 0.001 });
    this.wirePointer();

    this.gridLayer.addChild(
      this.water,
      this.waves,
      waterMask,
      this.grid,
      this.hover,
      this.ships,
      this.hitGlow,
      this.markers,
      this.fx,
      this.flash,
      this.hitBox,
    );
    this.root.addChild(this.frame, this.title, labels, this.gridLayer);
  }

  private wirePointer() {
    const interactive = this.handlers.onHover || this.handlers.onTap;
    if (!interactive) return;
    this.hitBox.eventMode = 'static';
    this.hitBox.cursor = 'pointer';
    const toCell = (e: FederatedPointerEvent) => {
      const local = e.getLocalPosition(this.hitBox);
      return cellAt(local.x, local.y, this.layout.cell);
    };
    this.hitBox.on('pointermove', (e) => {
      const cell = toCell(e);
      this.setHover(cell);
      this.handlers.onHover?.(cell);
    });
    this.hitBox.on('pointerout', () => {
      this.setHover(null);
      this.handlers.onHover?.(null);
    });
    this.hitBox.on('pointertap', (e) => {
      const cell = toCell(e);
      if (!cell || !this.handlers.onTap) return;
      if (this.slot === 'opponent' && !this.canFireAt(cell)) return;
      this.handlers.onTap(cell);
    });
  }

  private canFireAt(cell: Cell): boolean {
    if (!this.input?.canFire) return false;
    return !this.input.board.shots.some(
      (s) => s.x === cell.x && s.y === cell.y,
    );
  }

  private setHover(cell: Cell | null) {
    this.hoverCell = cell;
    if (this.slot === 'opponent') {
      this.hitBox.cursor =
        cell && this.canFireAt(cell) ? 'crosshair' : 'not-allowed';
      if (!this.input?.canFire) this.hitBox.cursor = 'default';
    }
    this.drawHover();
  }

  private drawWater() {
    const { cell } = this.layout;
    this.water
      .roundRect(0, 0, this.boardPx, this.boardPx, cell * 0.15)
      .fill(WATER_DEEP);
    // Faint checker gives depth without competing with the markers.
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if ((x + y) % 2 === 0) continue;
        this.water.rect(x * cell, y * cell, cell, cell);
      }
    }
    this.water.fill({ color: WATER, alpha: 0.55 });
  }

  private drawGrid() {
    const { cell } = this.layout;
    for (let i = 1; i < BOARD_SIZE; i++) {
      this.grid.moveTo(i * cell, 0).lineTo(i * cell, this.boardPx);
      this.grid.moveTo(0, i * cell).lineTo(this.boardPx, i * cell);
    }
    this.grid.stroke({ width: 1, color: GRID_LINE, alpha: 0.55 });
    this.grid
      .roundRect(0, 0, this.boardPx, this.boardPx, cell * 0.15)
      .stroke({ width: 1.5, color: GRID_LINE });
  }

  private drawWaves(time: number) {
    const { cell } = this.layout;
    const g = this.waves;
    g.clear();
    const rows = BOARD_SIZE * WAVE_ROWS_PER_CELL;
    const step = this.boardPx / WAVE_SEGMENTS;
    for (let r = 0; r < rows; r++) {
      const baseY = (r + 0.5) * (this.boardPx / rows);
      const phase = time * WAVE_SPEED + r * 1.7;
      g.moveTo(0, baseY + Math.sin(phase) * cell * 0.08);
      for (let s = 1; s <= WAVE_SEGMENTS; s++) {
        const x = s * step;
        g.lineTo(x, baseY + Math.sin(phase + s * 0.55) * cell * 0.08);
      }
    }
    g.stroke({ width: 1, color: WAVE, alpha: 0.14 });
  }

  private drawHover() {
    const g = this.hover;
    g.clear();
    const cell = this.hoverCell;
    if (!cell || this.slot !== 'opponent' || !this.input?.canFire) return;
    const size = this.layout.cell;
    const px = cell.x * size;
    const py = cell.y * size;
    g.rect(0, py, this.boardPx, size).fill({ color: RETICLE, alpha: 0.06 });
    g.rect(px, 0, size, this.boardPx).fill({ color: RETICLE, alpha: 0.06 });

    const color = this.canFireAt(cell) ? RETICLE : PREVIEW_BAD;
    const cx = px + size / 2;
    const cy = py + size / 2;
    const r = size * 0.32;
    const tick = size * 0.14;
    g.circle(cx, cy, r)
      .moveTo(cx - r - tick, cy)
      .lineTo(cx - r + tick, cy)
      .moveTo(cx + r - tick, cy)
      .lineTo(cx + r + tick, cy)
      .moveTo(cx, cy - r - tick)
      .lineTo(cx, cy - r + tick)
      .moveTo(cx, cy + r - tick)
      .lineTo(cx, cy + r + tick)
      .stroke({ width: Math.max(1.5, size * 0.06), color });
  }

  update(input: BoardInput, freshShots: ShotView[], now: number) {
    this.input = input;
    this.title.text = input.title.toUpperCase();
    this.title.style.fill = input.active ? ACCENT : TEXT_DIM;
    this.drawFrameBorder(input.active);
    this.drawShips(input);
    this.drawMarkers(input.board.shots);
    this.drawHover();
    if (this.slot === 'opponent' && !input.canFire)
      this.hitBox.cursor = 'default';

    if (this.motion === 'reduced') return;
    for (const shot of freshShots) {
      this.effects.push({
        kind: shot.hit ? 'burst' : 'ripple',
        cell: shot,
        start: now,
      });
      if (shot.hit) this.flashStart = now;
    }
  }

  private drawFrameBorder(active: boolean) {
    const { cell, gutter, titleBand } = this.layout;
    const w = gutter + this.boardPx + EDGE_PAD * 2;
    const h = titleBand + gutter + this.boardPx + EDGE_PAD * 2;
    this.frame
      .clear()
      .roundRect(0, 0, w, h, cell * 0.3)
      .fill(PANEL)
      .stroke({
        width: active ? 2 : 1,
        color: active ? ACCENT : BORDER,
        alpha: active ? 0.9 : 1,
      });
  }

  private drawShips(input: BoardInput) {
    const g = this.ships;
    const { cell } = this.layout;
    g.clear();

    // On the opponent's board a ship is only ever present once sunk or
    // once the match ends (masking.ts); an unsunk one there is a reveal.
    for (const ship of input.board.ships) {
      const hull = hullFor(ship.cells);
      if (!hull) continue;
      const style = ship.sunk
        ? { fill: SUNK_HULL, edge: SUNK_EDGE, alpha: 1, details: false }
        : this.slot === 'opponent'
          ? { fill: REVEALED_HULL, edge: HULL_EDGE, alpha: 0.75, details: true }
          : { fill: HULL, edge: HULL_EDGE, alpha: 1, details: true };
      drawHull(g, hull, cell, style);
      if (ship.sunk) drawSunkMarks(g, ship.cells, cell);
    }

    for (const ship of input.pendingShips) {
      const hull = hullFor(cellsFor(ship));
      if (hull)
        drawHull(g, hull, cell, {
          fill: HULL,
          edge: HULL_EDGE,
          alpha: 1,
          details: true,
        });
    }

    const inside = input.previewCells.filter(isInsideGrid);
    const preview = hullFor(inside);
    if (!preview) return;
    const color = input.previewValid ? PREVIEW_OK : PREVIEW_BAD;
    if (input.previewValid) {
      drawHull(g, preview, cell, {
        fill: color,
        edge: color,
        alpha: 0.5,
        details: false,
      });
      return;
    }
    for (const c of inside) {
      g.rect(c.x * cell + 1, c.y * cell + 1, cell - 2, cell - 2);
    }
    g.fill({ color, alpha: 0.4 });
  }

  private drawMarkers(shots: ShotView[]) {
    const { cell } = this.layout;
    const markers = this.markers;
    const glow = this.hitGlow;
    markers.clear();
    glow.clear();
    for (const shot of shots) {
      const cx = shot.x * cell + cell / 2;
      const cy = shot.y * cell + cell / 2;
      if (!shot.hit) {
        markers.circle(cx, cy, cell * 0.22).stroke({
          width: Math.max(1, cell * 0.05),
          color: MISS,
          alpha: 0.55,
        });
        markers.circle(cx, cy, cell * 0.09).fill({ color: MISS, alpha: 0.85 });
        continue;
      }
      glow
        .circle(cx, cy, cell * 0.46)
        .fill({ color: HIT_GLOW, alpha: shot.sunk ? 0.18 : 0.35 });
      drawFlame(markers, cx, cy, cell, shot.sunk ? 0.7 : 1);
    }
  }

  tick(now: number) {
    if (this.motion === 'full') {
      this.drawWaves(now);
      this.hitGlow.alpha = 0.65 + Math.sin(now * HIT_PULSE_SPEED) * 0.35;
      this.frame.alpha = this.input?.active
        ? 0.92 + Math.sin(now * ACTIVE_PULSE_SPEED) * 0.08
        : 1;
    }
    this.drawEffects(now);
  }

  private drawEffects(now: number) {
    const g = this.fx;
    const { cell } = this.layout;
    g.clear();
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]!;
      const duration = effect.kind === 'burst' ? BURST_MS : RIPPLE_MS;
      const t = (now - effect.start) / duration;
      if (t >= 1) {
        this.effects.splice(i, 1);
        continue;
      }
      const cx = effect.cell.x * cell + cell / 2;
      const cy = effect.cell.y * cell + cell / 2;
      const ease = 1 - (1 - t) ** 3;
      if (effect.kind === 'burst') {
        g.circle(cx, cy, cell * (0.3 + ease * 1.1)).stroke({
          width: Math.max(1, cell * 0.12 * (1 - t)),
          color: HIT_FLAME,
          alpha: 1 - t,
        });
        g.circle(cx, cy, cell * (0.2 + ease * 0.4)).fill({
          color: HIT_CORE,
          alpha: (1 - t) * 0.6,
        });
        for (let k = 0; k < 8; k++) {
          const angle = (k / 8) * Math.PI * 2 + effect.start;
          const dist = cell * (0.3 + ease * 0.9);
          g.circle(
            cx + Math.cos(angle) * dist,
            cy + Math.sin(angle) * dist,
            cell * 0.06 * (1 - t),
          ).fill({ color: HIT_CORE, alpha: 1 - t });
        }
      } else {
        for (const lag of [0, 0.25]) {
          const lt = clamp((t - lag) / (1 - lag), 0, 1);
          if (lt <= 0) continue;
          g.circle(cx, cy, cell * (0.15 + lt * 0.55)).stroke({
            width: Math.max(1, cell * 0.05),
            color: MISS,
            alpha: (1 - lt) * 0.8,
          });
        }
      }
    }

    this.flash.clear();
    const ft = (now - this.flashStart) / FLASH_MS;
    if (ft >= 0 && ft < 1) {
      this.flash
        .roundRect(0, 0, this.boardPx, this.boardPx, cell * 0.15)
        .fill({ color: HIT_FLAME, alpha: 0.18 * (1 - ft) });
    }
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}

function drawFlame(
  g: Graphics,
  cx: number,
  cy: number,
  cell: number,
  alpha: number,
) {
  const r = cell * 0.3;
  // Teardrop: round base with a pointed tip, layered hot-to-cold.
  const drop = (scale: number, color: number) => {
    const s = r * scale;
    g.moveTo(cx, cy - s * 1.35)
      .bezierCurveTo(
        cx + s * 0.9,
        cy - s * 0.4,
        cx + s,
        cy + s * 0.9,
        cx,
        cy + s,
      )
      .bezierCurveTo(
        cx - s,
        cy + s * 0.9,
        cx - s * 0.9,
        cy - s * 0.4,
        cx,
        cy - s * 1.35,
      )
      .fill({ color, alpha });
  };
  drop(1, HIT_GLOW);
  drop(0.72, HIT_FLAME);
  drop(0.42, HIT_CORE);
}

export interface SceneInput {
  mode: CanvasMode;
  boards: Partial<Record<BoardSlot, BoardInput>>;
}

const SLOT_ORDER: BoardSlot[] = ['own', 'opponent'];

// Owns every Pixi object for the Battleship canvas. React calls update() on
// each render and tick() from the ticker; the scene redraws into long-lived
// Graphics (clear + redraw) rather than creating objects per frame.
export class BattleshipScene {
  private views: Partial<Record<BoardSlot, BoardRenderer>> = {};
  private readonly seenShots: Record<BoardSlot, Set<string> | null> = {
    own: null,
    opponent: null,
  };
  private layout: CanvasLayout | null = null;
  private readonly stage: Container;
  private readonly handlers: Record<BoardSlot, BoardHandlers>;
  private readonly motion: MotionPreference;

  constructor(
    stage: Container,
    handlers: Record<BoardSlot, BoardHandlers>,
    motion: MotionPreference,
  ) {
    this.stage = stage;
    this.handlers = handlers;
    this.motion = motion;
  }

  setLayout(layout: CanvasLayout, slots: BoardSlot[]) {
    this.layout = layout;
    for (const view of Object.values(this.views)) view?.destroy();
    this.views = {};
    slots.forEach((slot, i) => {
      const block = layout.blocks[i];
      if (!block) return;
      const view = new BoardRenderer(
        layout,
        block,
        slot,
        this.handlers[slot],
        this.motion,
      );
      this.views[slot] = view;
      this.stage.addChild(view.root);
    });
  }

  hasLayout(layout: CanvasLayout, slots: BoardSlot[]): boolean {
    const current = this.layout;
    if (!current) return false;
    const currentSlots = SLOT_ORDER.filter((s) => this.views[s]);
    return (
      current.cell === layout.cell &&
      current.arrangement === layout.arrangement &&
      currentSlots.join() === slots.join()
    );
  }

  update(input: SceneInput, now: number) {
    for (const slot of SLOT_ORDER) {
      const view = this.views[slot];
      const board = input.boards[slot];
      if (!view || !board) continue;
      // The first time a board is seen, its existing shots are history,
      // not events — only shots arriving after that get animated.
      let seen = this.seenShots[slot];
      if (!seen) {
        seen = new Set(board.board.shots.map(shotKey));
        this.seenShots[slot] = seen;
      }
      view.update(board, takeNewShots(seen, board.board.shots), now);
    }
  }

  tick(now: number) {
    for (const view of Object.values(this.views)) view?.tick(now);
  }
}
