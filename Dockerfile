# ── Stage 1: builder ─────────────────────────────────────────────
# Compiles native modules (canvas, sharp, etc.) against the target libs.
# Build toolchain stays in this stage and never reaches the final image.
FROM oven/bun:1-alpine AS builder

RUN apk add --no-cache \
    python3 make g++ pkgconfig \
    pixman-dev cairo-dev pango-dev giflib-dev jpeg-dev

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile

# ── Stage 2: runtime ─────────────────────────────────────────────
FROM oven/bun:1-alpine AS runtime

RUN apk add --no-cache \
    ffmpeg \
    pixman cairo pango giflib libjpeg-turbo

WORKDIR /app

RUN addgroup -S marquinhos && adduser -S marquinhos -G marquinhos

COPY package.json bun.lock* ./

# Reuse pre-compiled node_modules — no build toolchain needed at runtime
COPY --from=builder /app/node_modules ./node_modules

# Copy source (Bun runs TypeScript natively)
COPY src/ ./src/

USER marquinhos

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD pgrep -f "bun" || exit 1

CMD ["bun", "src/index.ts"]
