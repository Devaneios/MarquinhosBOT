# ── Stage 1: builder ─────────────────────────────────────────────
# Build toolchain stays in this stage and never reaches the final image.
FROM oven/bun:1.4.2-alpine AS builder

WORKDIR /app

COPY package.json bun.lock* ./
COPY apps/bot/package.json ./apps/bot/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/activity/package.json ./apps/activity/package.json

RUN bun install --frozen-lockfile --os=linux --cpu=x64

# Generate the merged validation word list from wordlist + devaneios-wordlist
COPY apps/api/wordlist.txt apps/api/devaneios-wordlist.txt ./apps/api/
COPY apps/api/scripts/ ./apps/api/scripts/
WORKDIR /app/apps/api
RUN bun run scripts/build-valid-guesses.ts

# ── Stage 2: runtime ─────────────────────────────────────────────
FROM oven/bun:1.4.2-alpine AS runtime

# GID of the host's `docker` group, so the non-root app user can read/write
# /var/run/docker.sock once it's bind-mounted in (needed to manage sandbox
# sibling containers via dockerode). Pass with:
#   --build-arg DOCKER_GID=$(getent group docker | cut -d: -f3)
ARG DOCKER_GID=999

WORKDIR /app

# SandboxManager execs commands in sibling containers via `docker exec` rather
# than dockerode's own exec path, which is broken under Bun — see the comment
# in sandbox/DockerodeSandboxClient.ts. That needs the CLI present at runtime.
RUN apk add --no-cache docker-cli

RUN addgroup -S marquinhos && adduser -S marquinhos -G marquinhos \
    && ( getent group ${DOCKER_GID} > /dev/null || addgroup -g ${DOCKER_GID} dockerhost ) \
    && addgroup marquinhos "$(getent group ${DOCKER_GID} | cut -d: -f1)"

COPY package.json bun.lock* ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json

# Reuse pre-compiled node_modules — no build toolchain needed at runtime
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Copy source (Bun runs TypeScript natively)
COPY apps/api/src/ ./apps/api/src/
COPY apps/api/wordlist.txt ./apps/api/
COPY apps/api/devaneios-wordlist.txt ./apps/api/
COPY --from=builder /app/apps/api/valid-guesses.txt ./apps/api/

WORKDIR /app/apps/api

RUN mkdir -p /app/data && chown marquinhos:marquinhos /app/data

RUN bun -e "const pkg = await Bun.file('/app/apps/api/package.json').json(); for (const name of Object.keys(pkg.dependencies)) { try { await import(name) } catch (error) { throw new Error(name + ': ' + error.message) } } process.env.SQLITE_PATH = ':memory:'; await import('database/sqlite'); process.exit(0)"

USER marquinhos

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["bun", "src/index.ts"]
