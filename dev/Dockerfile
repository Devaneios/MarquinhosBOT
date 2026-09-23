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
RUN HUSKY=0 pnpm install --frozen-lockfile

FROM oven/bun:1.4.2-debian
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config curl ffmpeg docker.io \
    libpixman-1-dev libcairo2-dev libpango1.0-dev libgif-dev libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app /app
COPY dev ./dev
COPY turbo.json ./
RUN cd apps/api && bun scripts/build-valid-guesses.ts
RUN mkdir -p /app/data
CMD ["bun", "run", "dev"]
