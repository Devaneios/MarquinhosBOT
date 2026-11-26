import {
  ACHIEVEMENT_RARITY_PALETTES,
  type AchievementRarity,
} from './rarityPalette';

const PIXEL_SIZE = 4;
const CORNER_CYCLE_MS = 2400;

interface Fragment {
  x: number;
  y: number;
  width: number;
  height: number;
  release: number;
  life: number;
  drift: number;
  rise: number;
  color: string;
  cutout: string;
}

export function animateBannerPixels(
  banner: HTMLElement,
  trail: HTMLCanvasElement,
  exitDuration: number | null,
  rarity: AchievementRarity,
) {
  const { offsetWidth: width, offsetHeight: height } = banner;
  if (width === 0 || height === 0) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const context = trail.getContext('2d');
  if (!context) return;

  const exiting = exitDuration !== null;
  const palette = ACHIEVEMENT_RARITY_PALETTES[rarity];
  const fragmentColors = [
    palette.highlight,
    palette.base,
    palette.shadow,
    palette.deep,
  ];
  const pixelSize = exiting ? PIXEL_SIZE : 3;
  const padding = exiting ? 88 : 64;
  const ratio = window.devicePixelRatio || 1;
  const trailWidth = width + 2 * padding;
  const trailHeight = height + 2 * padding;
  trail.width = Math.ceil(trailWidth * ratio);
  trail.height = Math.ceil(trailHeight * ratio);
  trail.style.width = `${trailWidth}px`;
  trail.style.height = `${trailHeight}px`;
  trail.style.left = `-${padding}px`;
  trail.style.top = `-${padding}px`;
  context.setTransform(ratio, 0, 0, ratio, padding * ratio, padding * ratio);

  const start = performance.now();
  const fragments: Fragment[] = [];
  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      const cellWidth = Math.min(pixelSize, width - x);
      const cellHeight = Math.min(pixelSize, height - y);
      const horizontal = Math.min(x, width - x - cellWidth);
      const vertical = Math.min(y, height - y - cellHeight);
      const depth = Math.min(horizontal, vertical);
      const corner = Math.max(horizontal, vertical);
      const rightHalf = x >= width / 2;
      const lowerHalf = y >= height / 2;
      if (depth < 4 && corner < 8) continue;
      const seed = ((x + 1) * 73856093) ^ ((y + 1) * 19349663);
      const noise = (seed >>> 0) % 100;
      // Keep these source bands aligned with the worn notches in global.css.
      const fromTopLeftNotch =
        (y === 0 && x >= 12 && x < 36) || (x === 0 && y >= 28 && y < 52);
      const fromBottomRightNotch =
        (y + cellHeight >= height &&
          width - x - cellWidth >= 12 &&
          width - x - cellWidth < 36) ||
        (x + cellWidth >= width &&
          height - y - cellHeight >= 28 &&
          height - y - cellHeight < 52);
      if (!exiting && !(fromTopLeftNotch || fromBottomRightNotch)) {
        continue;
      }

      const outward = rightHalf ? 1 : -1;
      const sideEdge = horizontal < vertical;
      const travel = exiting ? 10 + (noise % 13) : 22 + (noise % 19);
      const verticalOutward = lowerHalf ? 1 : -1;
      const tangentOutward = noise % 2 === 0 ? 1 : -1;
      const angleNoise = ((seed >>> 8) % 100) / 100;
      const angle = (angleNoise * 2 - 1) * (Math.PI / 3);
      const normalTravel = travel * Math.cos(angle);
      const tangentTravel = travel * Math.sin(angle) * tangentOutward;
      const diagonalProgress =
        (x / width + y / height + cellWidth / width + cellHeight / height) / 2;
      const cornerWave = Math.min(diagonalProgress, 1 - diagonalProgress) * 2;
      const release = exiting
        ? Math.round(
            (cornerWave * (exitDuration ?? 0) * 0.5 + (noise % 12)) / 16,
          ) * 16
        : (seed >>> 0) % CORNER_CYCLE_MS;
      fragments.push({
        x,
        y,
        width: exiting ? cellWidth : pixelSize,
        height: exiting ? cellHeight : pixelSize,
        release,
        life: exiting ? 180 + (noise % 32) * 4 : 1850 + (noise % 450),
        drift: sideEdge ? outward * normalTravel : tangentTravel,
        rise: sideEdge ? -tangentTravel : -verticalOutward * normalTravel,
        color: exiting
          ? (fragmentColors[noise % fragmentColors.length] ?? palette.base)
          : palette.highlight,
        cutout: `M${x} ${y}h${cellWidth}v${cellHeight}h-${cellWidth}Z`,
      });
    }
  }

  if (fragments.length === 0) return;
  fragments.sort((a, b) => a.release - b.release);
  // Each fragment is drawn in the same coordinate space as its cutout.
  const outline = `M0 0H${width}V${height}H0Z`;
  let previousCutouts = '';
  let hasParticles = false;
  let frame = 0;

  function draw(now: number) {
    const elapsed = now - start;
    if (exitDuration !== null && elapsed >= exitDuration) return;

    const playhead = exiting ? elapsed : elapsed % CORNER_CYCLE_MS;
    let cutouts = '';
    if (hasParticles) {
      context?.clearRect(-padding, -padding, trailWidth, trailHeight);
      hasParticles = false;
    }
    for (const fragment of fragments) {
      const age = playhead - fragment.release;
      if (exiting && age < 0) break;
      const wrappedAge = age < 0 ? age + CORNER_CYCLE_MS : age;
      const progress = wrappedAge / fragment.life;
      if (exiting) cutouts += fragment.cutout;
      if (progress >= 1 || !context) continue;

      const distance = progress * (2 - progress);
      context.globalAlpha = exiting
        ? Math.min(1, (1 - progress) * 1.65)
        : 0.85 * (1 - progress);
      context.fillStyle = fragment.color;
      const x =
        Math.round((fragment.x + fragment.drift * distance) * ratio) / ratio;
      const y =
        Math.round((fragment.y - fragment.rise * distance) * ratio) / ratio;
      const width = Math.round(fragment.width * ratio) / ratio;
      const height = Math.round(fragment.height * ratio) / ratio;
      context.fillRect(x, y, width, height);
      hasParticles = true;
    }
    if (cutouts !== previousCutouts) {
      banner.style.clipPath = cutouts
        ? `path(evenodd, "${outline}${cutouts}")`
        : '';
      previousCutouts = cutouts;
    }
    frame = window.requestAnimationFrame(draw);
  }

  frame = window.requestAnimationFrame(draw);
  return () => {
    window.cancelAnimationFrame(frame);
    banner.style.removeProperty('clip-path');
  };
}
