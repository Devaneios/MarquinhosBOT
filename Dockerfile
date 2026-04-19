# ── Stage 1: builder ─────────────────────────────────────────────
# Compiles native modules (canvas, sharp, etc.) against the target libs.
# Build toolchain stays in this stage and never reaches the final image.
FROM oven/bun:1-debian AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config \
    libpixman-1-dev libcairo2-dev libpango1.0-dev libgif-dev libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/

RUN bun run build

# ── Stage 2: runtime ─────────────────────────────────────────────
FROM oven/bun:1-debian AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg procps \
    libpixman-1-0 libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgif7 libjpeg62-turbo \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN groupadd marquinhos && useradd -g marquinhos marquinhos

COPY package.json bun.lock* ./

# Reuse pre-compiled node_modules — no build toolchain needed at runtime
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/dist ./dist

USER marquinhos

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD pgrep -f "bun" || exit 1

CMD ["bun", "dist/index.js"]
