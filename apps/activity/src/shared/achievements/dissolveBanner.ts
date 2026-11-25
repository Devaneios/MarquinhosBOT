const PIXEL_SIZE = 4;
const CORNER_CYCLE_MS = 820;
const FRAGMENT_COLORS = ['#b9815d', '#e9b67f', '#ffe3af', '#fff1d3'];

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
) {
  const { offsetWidth: width, offsetHeight: height } = banner;
  if (width === 0 || height === 0) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const context = trail.getContext('2d');
  if (!context) return;

  const exiting = exitDuration !== null;
  const padding = exiting ? 88 : 28;
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
  for (let y = 0; y < height; y += PIXEL_SIZE) {
    for (let x = 0; x < width; x += PIXEL_SIZE) {
      const cellWidth = Math.min(PIXEL_SIZE, width - x);
      const cellHeight = Math.min(PIXEL_SIZE, height - y);
      const horizontal = Math.min(x, width - x - cellWidth);
      const vertical = Math.min(y, height - y - cellHeight);
      const depth = Math.min(horizontal, vertical);
      const corner = Math.max(horizontal, vertical);
      const rightHalf = x >= width / 2;
      const lowerHalf = y >= height / 2;
      if (depth < 4 && corner < 8) continue;
      const seed = ((x + 1) * 73856093) ^ ((y + 1) * 19349663);
      const noise = (seed >>> 0) % 100;
      if (exiting) {
        if (
          depth >= 20 + Math.max(0, 18 - corner / 2) ||
          (depth >= 8 && noise < depth)
        )
          continue;
      } else if (rightHalf !== lowerHalf || depth >= 8 || corner >= 24) {
        continue;
      }

      const outward = rightHalf ? 1 : -1;
      const sideEdge = horizontal < vertical;
      const tangent = 3 + (noise % 5);
      const travel = 10 + (noise % 13);
      const release = exiting
        ? Math.round((28 + corner * 0.83 + depth * 5.2 + noise * 0.66) / 16) *
          16
        : seed >>> 0;
      fragments.push({
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        release,
        life: exiting ? 210 + (noise % 37) * 5 : 500 + (noise % 125),
        drift: exiting
          ? (noise % 19) - 9 + outward * Math.max(0, 20 - horizontal)
          : outward * (sideEdge ? travel : tangent),
        rise: exiting
          ? 20 + ((seed >>> 9) % 57)
          : -outward * (sideEdge ? tangent : travel),
        color: exiting
          ? (FRAGMENT_COLORS[noise % FRAGMENT_COLORS.length] ?? '#e9b67f')
          : '#f4e7d2',
        cutout: `M${x} ${y}h${cellWidth}v${cellHeight}h-${cellWidth}Z`,
      });
    }
  }

  if (fragments.length === 0) return;
  fragments.sort((a, b) => a.release - b.release);
  if (!exiting) {
    const upperLeft = fragments.filter((fragment) => fragment.x < width / 2);
    const lowerRight = fragments.filter((fragment) => fragment.x >= width / 2);
    upperLeft.forEach((fragment, index) => {
      fragment.release = (index / upperLeft.length) * CORNER_CYCLE_MS;
    });
    lowerRight.forEach((fragment, index) => {
      fragment.release = ((index + 0.5) / lowerRight.length) * CORNER_CYCLE_MS;
    });
  }
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
      if (exiting || progress < 1) cutouts += fragment.cutout;
      if (progress >= 1 || !context) continue;

      const distance = progress * (2 - progress);
      context.globalAlpha = exiting
        ? Math.min(1, (1 - progress) * 1.65)
        : 0.85 * (1 - progress);
      context.fillStyle = fragment.color;
      context.fillRect(
        Math.round(fragment.x + fragment.drift * distance),
        Math.round(fragment.y - fragment.rise * distance),
        fragment.width,
        fragment.height,
      );
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
