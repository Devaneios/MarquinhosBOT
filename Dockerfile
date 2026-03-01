FROM oven/bun:1-alpine

RUN apk add --no-cache ffmpeg python3 make g++ pkgconfig pixman cairo-dev pango-dev giflib-dev jpeg-dev

WORKDIR /app

COPY package.json bun.lockb* ./

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]