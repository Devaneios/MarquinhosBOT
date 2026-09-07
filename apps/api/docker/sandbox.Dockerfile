# Image for ephemeral agent-tool-calling sandbox sessions (see SandboxManager).
# Isolation comes from the container boundary the caller applies at creation
# time (NetworkMode: none, ReadonlyRootfs, resource limits) — this image is
# deliberately minimal, not hardened on its own.
FROM oven/bun:1-alpine

RUN apk add --no-cache python3 bash

CMD ["sleep", "infinity"]
