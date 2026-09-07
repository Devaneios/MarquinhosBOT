# ── Stage 1: builder ─────────────────────────────────────────────
# Compiles native modules (canvas, sharp, etc.) against the target libs.
# Build toolchain stays in this stage and never reaches the final image.
FROM oven/bun:1.4.2-debian AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config \
    libpixman-1-dev libcairo2-dev libpango1.0-dev libgif-dev libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock* ./
COPY apps/bot/package.json ./apps/bot/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/activity/package.json ./apps/activity/package.json

RUN bun install --frozen-lockfile --os=linux --cpu=x64

COPY apps/bot/tsconfig.json ./apps/bot/tsconfig.json
COPY apps/bot/src/ ./apps/bot/src/

WORKDIR /app/apps/bot
RUN bun run build

# ── Stage 2: runtime ─────────────────────────────────────────────
FROM oven/bun:1.4.2-debian AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg procps \
    libpixman-1-0 libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgif7 libjpeg62-turbo \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN groupadd marquinhos && useradd -g marquinhos marquinhos

COPY package.json bun.lock* ./
COPY apps/bot/package.json ./apps/bot/package.json

# Reuse pre-compiled node_modules — no build toolchain needed at runtime
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/bot/node_modules ./apps/bot/node_modules

COPY --from=builder /app/apps/bot/dist ./apps/bot/dist

WORKDIR /app/apps/bot

RUN bun -e "const { default: sharp } = await import('sharp'); await sharp({ create: { width: 1, height: 1, channels: 4, background: '#000' } }).png().toBuffer(); const { Root, terminate } = await import('@meonode/canvas'); const canvas = await Root({ width: 1, height: 1, workerMode: false, children: [] }); await canvas.toBuffer('png'); canvas.release?.(); terminate(); await import('@napi-rs/canvas'); await import('@snazzah/davey'); await import('mediaplex'); const { default: ffmpegPath } = await import('ffmpeg-static'); if (!ffmpegPath || !(await Bun.file(ffmpegPath).exists())) throw new Error('ffmpeg-static binary is missing')"

USER marquinhos

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD pgrep -f "bun" || exit 1

CMD ["bun", "dist/index.js"]
