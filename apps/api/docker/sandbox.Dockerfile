# Image for ephemeral agent-tool-calling sandbox sessions (see SandboxManager).
# Isolation comes from the container boundary the caller applies at creation
# time (NetworkMode: none, ReadonlyRootfs, CapDrop ALL, no-new-privileges, resource limits).
FROM oven/bun:1-alpine

RUN apk add --no-cache python3 bash \
    && addgroup -S sandbox \
    && adduser -S sandbox -G sandbox

USER sandbox

CMD ["sleep", "infinity"]
