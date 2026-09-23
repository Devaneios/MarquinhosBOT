FROM node:22-bookworm AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config \
    libpixman-1-dev libcairo2-dev libpango1.0-dev libgif-dev libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11.10.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages
RUN HUSKY=0 pnpm install --filter 'marquinhosbot...' --frozen-lockfile

FROM oven/bun:1.4.2-debian AS builder
WORKDIR /app
COPY --from=deps /app /app
WORKDIR /app/apps/bot
RUN bun run build

FROM oven/bun:1.4.2-debian AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ffmpeg procps \
    libpixman-1-0 libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgif7 libjpeg62-turbo \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN groupadd marquinhos && useradd -g marquinhos marquinhos
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=deps /app/packages ./packages
COPY package.json ./
COPY apps/bot/package.json ./apps/bot/package.json
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist
WORKDIR /app/apps/bot
RUN bun -e "const { default: sharp } = await import('sharp'); await sharp({ create: { width: 1, height: 1, channels: 4, background: '#000' } }).png().toBuffer(); const { Root, terminate } = await import('@meonode/canvas'); const canvas = await Root({ width: 1, height: 1, workerMode: false, children: [] }); await canvas.toBuffer('png'); canvas.release?.(); terminate(); await import('@napi-rs/canvas'); await import('@snazzah/davey'); await import('mediaplex'); const { default: ffmpegPath } = await import('ffmpeg-static'); if (!ffmpegPath || !(await Bun.file(ffmpegPath).exists())) throw new Error('ffmpeg-static binary is missing')"
USER marquinhos
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl --fail --silent http://127.0.0.1:3001/healthz || exit 1
CMD ["bun", "dist/index.js"]
