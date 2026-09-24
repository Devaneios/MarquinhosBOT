# Marquinhos

pnpm workspace with Bun services containing the Discord bot, API, and Discord Activity frontend.

Daily development uses a dedicated Docker Compose stack with source watching,
an isolated PostgreSQL database, and a Cloudflare tunnel. Production releases use
the separate deployment workflow.

Install Node 22, pnpm 11.10.0, and Bun 1.4.2, then run `pnpm install --frozen-lockfile`. Start with [local development](docs/local-development.md) for environment setup,
Discord URL mapping, running the stack, and testing. See
[deployment](docs/deployment.md) for production operations.

| Command                | Purpose                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `pnpm run dev`          | Build as needed and start API, bot, Activity, and tunnel with combined logs  |
| `pnpm run dev:doctor`   | Check credentials, ports, routing, service health, and sandbox prerequisites |
| `pnpm run dev:down`     | Stop development containers and retain the database                          |
| `pnpm run dev:register` | Register slash commands for the configured development application           |
| `pnpm run dev:test`     | Build and run tests in disposable containers without live credentials        |

`deploy/deploy.sh` is for releases; it is not part of the development loop.
