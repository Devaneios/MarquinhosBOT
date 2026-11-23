import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { deflateSync } from 'node:zlib';
import { WORDLE_ACHIEVEMENT_CATALOG } from '../../../packages/domain/src/games/wordle/achievements/catalog';

const ROOT = import.meta.dir;
const SRC = join(ROOT, 'blueprints');
const REVIEW_ROOT = join(ROOT, '../../../docs/achievement-art');
const OUT = join(REVIEW_ROOT, 'png');
const REVIEW_STATUS = join(ROOT, 'review-status.json');
const PUBLIC_OUT = join(ROOT, '../public/achievements');
const BADGE = 16;
const EMBLEM = 14;
const OFFSET = (BADGE - EMBLEM) / 2;

type Rgb = [number, number, number];

const CHAR_TO_PALETTE_NAME: Record<string, string> = {
  K: 'Fundo / Contorno',
  A: 'Termo Absent',
  C: 'Common',
  W: 'Texto',
  G: 'Termo Correct',
  L: 'Accent Claro',
  Y: 'Termo Present',
  H: 'Warm Cream',
  S: 'Brown',
  P: 'Violet',
  V: 'Light Violet',
  D: 'Deep Violet',
  T: 'Light Teal',
  Q: 'Deep Green',
  U: 'Deep Teal',
  N: 'Light Gray',
  F: 'Flame Red',
  E: 'Light Coral',
  M: 'Deep Red',
  B: 'Rare',
  R: 'Epic',
  O: 'Legendary',
};

const RARITY_CHAR: Record<string, string> = {
  common: 'C',
  rare: 'B',
  epic: 'R',
  legendary: 'O',
};

function loadPaletteEntries(): Map<string, Rgb> {
  const lines = readFileSync(join(ROOT, 'palette.gpl'), 'utf8').split('\n');
  const byName = new Map<string, Rgb>();
  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\s+#[0-9a-f]{6}$/i);
    if (match) byName.set(match[4], [Number(match[1]), Number(match[2]), Number(match[3])]);
  }
  return byName;
}

const PALETTE_ENTRIES = loadPaletteEntries();

function loadPalette(): Record<string, Rgb> {
  const palette: Record<string, Rgb> = {};
  for (const [char, name] of Object.entries(CHAR_TO_PALETTE_NAME)) {
    const rgb = PALETTE_ENTRIES.get(name);
    if (!rgb) throw new Error(`palette.gpl has no color named "${name}"`);
    palette[char] = rgb;
  }
  return palette;
}

const PALETTE = loadPalette();
const ACHIEVEMENTS = new Map(
  WORDLE_ACHIEVEMENT_CATALOG.map((a) => [a.id.replace(/^wordle_v2_/, ''), a]),
);

function parseEmblem(id: string, text: string): string[] {
  const rows = text.replace(/\n+$/, '').split('\n');
  const errors: string[] = [];
  if (rows.length !== EMBLEM) errors.push(`has ${rows.length} rows, expected ${EMBLEM}`);
  rows.forEach((row, i) => {
    if (row.length !== EMBLEM) errors.push(`row ${i + 1} has ${row.length} chars, expected ${EMBLEM}`);
    const bad = [...row].filter((c) => c !== '.' && !(c in PALETTE));
    if (bad.length) errors.push(`row ${i + 1} uses unknown chars ${JSON.stringify([...new Set(bad)].join(''))}`);
  });
  if (errors.length) throw new Error(`${id}.txt ${errors.join('; ')}`);
  return rows;
}

function insideRounded(x: number, y: number, inset: number): boolean {
  const lo = inset;
  const hi = BADGE - 1 - inset;
  if (x < lo || x > hi || y < lo || y > hi) return false;
  const r = Math.max(0, 2 - inset);
  const cx = x < lo + r ? lo + r : x > hi - r ? hi - r : x;
  const cy = y < lo + r ? lo + r : y > hi - r ? hi - r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5;
}

function badgePixels(rows: string[], rarity: string): (Rgb | null)[][] {
  const ring = PALETTE[RARITY_CHAR[rarity]];
  const pixels: (Rgb | null)[][] = [];
  for (let y = 0; y < BADGE; y++) {
    const line: (Rgb | null)[] = [];
    for (let x = 0; x < BADGE; x++) {
      if (!insideRounded(x, y, 0)) line.push(null);
      else if (!insideRounded(x, y, 1)) line.push(ring);
      else {
        const ex = x - OFFSET;
        const ey = y - OFFSET;
        const c = rows[ey]?.[ex];
        line.push(c && c !== '.' ? PALETTE[c] : PALETTE.K);
      }
    }
    pixels.push(line);
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(pixels: (Rgb | null)[][], scale = 1): Buffer {
  const h = pixels.length * scale;
  const w = pixels[0].length * scale;
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const rowStart = y * (1 + w * 4);
    for (let x = 0; x < w; x++) {
      const px = pixels[Math.floor(y / scale)][Math.floor(x / scale)];
      const i = rowStart + 1 + x * 4;
      if (px) {
        raw[i] = px[0];
        raw[i + 1] = px[1];
        raw[i + 2] = px[2];
        raw[i + 3] = 255;
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array()),
  ]);
}

async function loadBadge(id: string): Promise<(Rgb | null)[][]> {
  const achievement = ACHIEVEMENTS.get(id);
  if (!achievement) throw new Error(`${id} is not an achievement id (strip the wordle_v2_ prefix)`);
  const file = Bun.file(join(SRC, `${id}.txt`));
  if (!(await file.exists())) throw new Error(`${id}.txt does not exist in ${SRC}`);
  return badgePixels(parseEmblem(id, await file.text()), achievement.rarity);
}

function loadReviewStatus(): Map<string, string> {
  const parsed = JSON.parse(readFileSync(REVIEW_STATUS, 'utf8')) as {
    achievements?: { id?: string; status?: string }[];
  };
  const statuses = new Map<string, string>();
  for (const entry of parsed.achievements ?? []) {
    if (!entry.id || !['pending', 'in_review', 'approved'].includes(entry.status ?? '')) {
      throw new Error(`Invalid review status entry: ${JSON.stringify(entry)}`);
    }
    if (!ACHIEVEMENTS.has(entry.id)) throw new Error(`${entry.id}: unknown achievement id in review status`);
    if (statuses.has(entry.id)) throw new Error(`${entry.id}: duplicate review status entry`);
    statuses.set(entry.id, entry.status!);
  }
  for (const id of ACHIEVEMENTS.keys()) {
    if (!statuses.has(id)) throw new Error(`${id}: missing review status entry`);
  }
  if (statuses.size !== ACHIEVEMENTS.size) throw new Error('Review status contains unexpected achievement entries');
  return statuses;
}

function scaffold(id: string): string {
  const achievement = ACHIEVEMENTS.get(id);
  if (!achievement || achievement.kind !== 'drawing') throw new Error(`${id} is not a drawing achievement`);
  const mask = achievement.drawing.mask;
  const rows = mask.length;
  const cols = mask[0].length;
  const fit = Math.floor((EMBLEM - 2 + 1) / Math.max(rows, cols));
  const pitch = fit >= 3 ? Math.min(fit, 4) : Math.floor((EMBLEM - 2) / Math.max(rows, cols));
  const tile = fit >= 3 ? pitch - 1 : pitch;
  const width = (cols - 1) * pitch + tile;
  const height = (rows - 1) * pitch + tile;
  const left = Math.floor((EMBLEM - width) / 2);
  const top = Math.floor((EMBLEM - height) / 2);
  const grid = Array.from({ length: EMBLEM }, () => Array(EMBLEM).fill('.'));
  mask.forEach((maskRow, r) => {
    [...maskRow].forEach((cell, c) => {
      for (let dy = 0; dy < tile; dy++) {
        for (let dx = 0; dx < tile; dx++) {
          if (cell === '#') grid[top + r * pitch + dy][left + c * pitch + dx] = 'G';
        }
      }
    });
  });
  const filled = grid.map((row) => row.map((cell) => cell === 'G'));
  filled.forEach((row, y) => row.forEach((cell, x) => {
    if (!cell) return;
    if (x + 1 < EMBLEM - 1 && y + 1 < EMBLEM - 1 && !filled[y + 1][x + 1]) {
      grid[y + 1][x + 1] = 'A';
    }
    if (!filled[y - 1]?.[x]) grid[y][x] = 'L';
  }));
  return grid.map((row) => row.join('')).join('\n') + '\n';
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'palette') {
    const pixels = [[...PALETTE_ENTRIES.values()]];
    await Bun.write(join(REVIEW_ROOT, 'palette.png'), encodePng(pixels));
    await Bun.write(join(REVIEW_ROOT, 'palette-preview.png'), encodePng(pixels, 16));
    console.log(`rendered ${PALETTE_ENTRIES.size} palette colors in palette.gpl order`);
    return;
  }
  if (command === 'scaffold') {
    for (const id of args) process.stdout.write(`${id}\n${scaffold(id)}\n`);
    return;
  }
  if (command === 'preview') {
    const [dir, ...ids] = args;
    mkdirSync(dir, { recursive: true });
    for (const id of ids) {
      const path = join(dir, `${id}.png`);
      await Bun.write(path, encodePng(await loadBadge(id)));
      console.log(`ok ${id} -> ${path}`);
    }
    return;
  }
  if (command === 'build') {
    const statuses = loadReviewStatus();
    mkdirSync(PUBLIC_OUT, { recursive: true });
    for (const id of ACHIEVEMENTS.keys()) {
      const outputPath = join(PUBLIC_OUT, `${id}.png`);
      if (statuses.get(id) === 'approved') {
        await Bun.write(outputPath, encodePng(await loadBadge(id)));
        console.log(`built approved badge ${id}`);
      } else {
        rmSync(outputPath, { force: true });
      }
    }
    return;
  }
  if (command === 'render') {
    mkdirSync(OUT, { recursive: true });
    const present = new Set(readdirSync(SRC).filter((f) => f.endsWith('.txt')).map((f) => basename(f, '.txt')));
    const ordered = [...ACHIEVEMENTS.keys()];
    const failures: string[] = [];
    const badges: ((Rgb | null)[][] | null)[] = [];
    for (const id of ordered) {
      if (!present.has(id)) {
        failures.push(`${id}: missing`);
        badges.push(null);
        continue;
      }
      try {
        const badge = await loadBadge(id);
        await Bun.write(join(OUT, `${id}.png`), encodePng(badge));
        badges.push(badge);
      } catch (error) {
        failures.push((error as Error).message);
        badges.push(null);
      }
    }
    for (const id of present) if (!ACHIEVEMENTS.has(id)) failures.push(`${id}.txt: not an achievement id`);
    const columns = 10;
    const cell = BADGE + 2;
    const sheetRows = Math.ceil(ordered.length / columns);
    const sheet: (Rgb | null)[][] = Array.from({ length: sheetRows * cell }, () =>
      Array(columns * cell).fill([40, 40, 42] as Rgb),
    );
    badges.forEach((badge, i) => {
      if (!badge) return;
      const ox = (i % columns) * cell + 1;
      const oy = Math.floor(i / columns) * cell + 1;
      badge.forEach((row, y) => row.forEach((px, x) => px && (sheet[oy + y][ox + x] = px)));
    });
    await Bun.write(join(REVIEW_ROOT, 'sheet.png'), encodePng(sheet, 6));
    console.log(`rendered ${badges.filter(Boolean).length}/${ordered.length} badges, sheet.png written`);
    for (const failure of failures) console.log(`FAIL ${failure}`);
    if (failures.length) process.exit(1);
    return;
  }
  console.log('usage: bun apps/activity/achievement-art/render.ts render | build | palette | preview <dir> <id...> | scaffold <id...>');
  process.exit(1);
}

await main();
