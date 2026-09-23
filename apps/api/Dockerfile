FROM node:22-alpine AS deps
RUN apk add --no-cache python3 make g++
RUN npm install -g pnpm@11.10.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages
RUN HUSKY=0 pnpm install --filter 'marquinhos-web-api...' --frozen-lockfile

FROM oven/bun:1.4.2-alpine AS builder
WORKDIR /app
COPY --from=deps /app /app
WORKDIR /app/apps/api
RUN bun run scripts/build-valid-guesses.ts

FROM oven/bun:1.4.2-alpine AS runtime
ARG DOCKER_GID=999
WORKDIR /app
RUN apk add --no-cache docker-cli
RUN addgroup -S marquinhos && adduser -S marquinhos -G marquinhos \
    && ( getent group ${DOCKER_GID} > /dev/null || addgroup -g ${DOCKER_GID} dockerhost ) \
    && addgroup marquinhos "$(getent group ${DOCKER_GID} | cut -d: -f1)"
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages ./packages
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/src/ ./apps/api/src/
COPY apps/api/wordlist.txt apps/api/devaneios-wordlist.txt ./apps/api/
COPY --from=builder /app/apps/api/valid-guesses.txt ./apps/api/
WORKDIR /app/apps/api
RUN mkdir -p /app/data && chown marquinhos:marquinhos /app/data
RUN bun -e "const pkg = await Bun.file('/app/apps/api/package.json').json(); for (const name of Object.keys(pkg.dependencies)) { if (name.startsWith('@marquinhos/')) continue; try { await import(name) } catch (error) { throw new Error(name + ': ' + error.message) } } process.env.SQLITE_PATH = ':memory:'; await import('@marquinhos/database/sqlite'); process.exit(0)"
USER marquinhos
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:${HTTP_PORT:-3000}/api/health || exit 1
CMD ["bun", "src/index.ts"]
