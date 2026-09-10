FROM oven/bun:1.4.2-debian

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config curl ffmpeg docker.io \
    libpixman-1-dev libcairo2-dev libpango1.0-dev libgif-dev libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/bot/package.json ./apps/bot/package.json
COPY apps/activity/package.json ./apps/activity/package.json
RUN HUSKY=0 bun install --frozen-lockfile

COPY apps ./apps
COPY dev ./dev
COPY turbo.json ./
RUN cd apps/api && bun scripts/build-valid-guesses.ts
RUN mkdir -p /app/data

CMD ["bun", "run", "dev"]
