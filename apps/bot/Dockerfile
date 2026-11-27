FROM node:24-bookworm AS deps
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

FROM --platform=$BUILDPLATFORM alpine:3.22 AS ffmpeg
ARG TARGETARCH
RUN apk add --no-cache curl tar xz \
    && case "$TARGETARCH" in \
        amd64) \
            asset='ffmpeg-N-129308-g17de9f8597-linux64-lgpl.tar.xz'; \
            checksum='671e661c5b0a9efd08e7dcb1922c1cc62c373adda4db4256b8fb7e5a87b39bac' \
            ;; \
        arm64) \
            asset='ffmpeg-N-129308-g17de9f8597-linuxarm64-lgpl.tar.xz'; \
            checksum='c23338337d870a038ce3e48042e11a9ff35bcb7e98c9c4bbc190ed7237ea5500' \
            ;; \
        *) echo "Unsupported target architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac \
    && curl --fail --location --silent --show-error \
        "https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/download/autobuild-2026-11-26-12-56/$asset" \
        --output /tmp/ffmpeg.tar.xz \
    && echo "$checksum  /tmp/ffmpeg.tar.xz" | sha256sum -cs \
    && mkdir -p /ffmpeg \
    && tar -xJf /tmp/ffmpeg.tar.xz --strip-components=2 --wildcards -C /ffmpeg '*/bin/ffmpeg' \
    && chmod 0755 /ffmpeg/ffmpeg

FROM oven/bun:1.4.2-debian AS builder
WORKDIR /app
COPY --from=deps /app /app
WORKDIR /app/apps/bot
RUN bun run build

FROM oven/bun:1.4.2-debian AS runtime
RUN apt-get update && apt-get upgrade -y --no-install-recommends && apt-get install -y --no-install-recommends \
    curl procps \
    libpixman-1-0 libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgif7 libjpeg62-turbo \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN groupadd marquinhos && useradd -g marquinhos marquinhos
COPY --from=ffmpeg /ffmpeg/ffmpeg /usr/local/bin/ffmpeg
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=deps /app/packages ./packages
COPY package.json ./
COPY apps/bot/package.json ./apps/bot/package.json
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist
WORKDIR /app/apps/bot
RUN find /app/node_modules/.pnpm -path '*/node_modules/ffmpeg-static/ffmpeg' -type f -exec ln -sf /usr/local/bin/ffmpeg {} \; \
    && ffmpeg -version \
    && bun -e "const { default: sharp } = await import('sharp'); await sharp({ create: { width: 1, height: 1, channels: 4, background: '#000' } }).png().toBuffer(); const { Root, terminate } = await import('@meonode/canvas'); const canvas = await Root({ width: 1, height: 1, workerMode: false, children: [] }); await canvas.toBuffer('png'); canvas.release?.(); terminate(); await import('@napi-rs/canvas'); await import('@snazzah/davey'); await import('mediaplex'); const { default: ffmpegPath } = await import('ffmpeg-static'); const { realpath } = await import('node:fs/promises'); if (!ffmpegPath || (await realpath(ffmpegPath)) !== '/usr/local/bin/ffmpeg') throw new Error('FFmpeg path is missing or incorrect')"
USER marquinhos
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl --fail --silent http://127.0.0.1:3001/healthz || exit 1
CMD ["bun", "dist/index.js"]
