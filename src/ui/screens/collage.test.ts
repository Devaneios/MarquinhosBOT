import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { createCollage } from './collage';

const OUT_DIR = join(import.meta.dir, '../../../test-output');
mkdirSync(OUT_DIR, { recursive: true });

async function solid(color: {
  r: number;
  g: number;
  b: number;
}): Promise<Buffer> {
  return sharp({
    create: {
      width: 300,
      height: 300,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

const palette = [
  { r: 180, g: 60, b: 60 },
  { r: 60, g: 140, b: 200 },
  { r: 220, g: 180, b: 80 },
  { r: 80, g: 160, b: 100 },
  { r: 160, g: 80, b: 180 },
  { r: 240, g: 120, b: 40 },
  { r: 40, g: 200, b: 200 },
  { r: 200, g: 40, b: 120 },
  { r: 120, g: 120, b: 200 },
  { r: 200, g: 200, b: 80 },
];

const images = await Promise.all(palette.map((color) => solid(color)));
const names = [
  'Radiohead - OK Computer',
  'Kendrick Lamar - To Pimp a Butterfly',
  'Caetano Veloso - Araca Azul',
  'Bjork - Homogenic',
  'Fiona Apple - Fetch the Bolt Cutters',
  'Tim Maia - Racional Vol. 1',
  'Massive Attack - Mezzanine',
  'Aphex Twin - Selected Ambient Works',
  'Arctic Monkeys - AM',
  'Gilberto Gil - Expresso 2222',
];

const buffer = await createCollage(
  images,
  names,
  'TesterUser',
  'albums',
  '1month',
);
writeFileSync(join(OUT_DIR, 'collage.png'), buffer);
console.log(`wrote ${OUT_DIR}/collage.png`);
