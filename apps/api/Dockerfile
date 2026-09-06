# ── Stage 1: builder ─────────────────────────────────────────────
# Build toolchain stays in this stage and never reaches the final image.
FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile

# Generate the merged validation word list from wordlist + devaneios-wordlist
COPY wordlist.txt devaneios-wordlist.txt ./
COPY scripts/ ./scripts/
RUN bun run scripts/build-valid-guesses.ts

# ── Stage 2: runtime ─────────────────────────────────────────────
FROM oven/bun:1-alpine AS runtime

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

COPY package.json bun.lock* tsconfig.json ./

# Reuse pre-compiled node_modules — no build toolchain needed at runtime
COPY --from=builder /app/node_modules ./node_modules

# Copy source (Bun runs TypeScript natively)
COPY src/ ./src/
COPY wordlist.txt ./
COPY devaneios-wordlist.txt ./
COPY --from=builder /app/valid-guesses.txt ./

RUN mkdir -p /app/data && chown marquinhos:marquinhos /app/data

USER marquinhos

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD pgrep -f "bun" || exit 1

CMD ["bun", "src/index.ts"]
