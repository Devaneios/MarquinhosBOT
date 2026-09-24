# Deployment

The deployment unit is `deploy/docker-compose.yml`. It runs PostgreSQL, the API, bot, and static Activity gateway on a Docker network. PostgreSQL publishes no host port; only the API reaches it. The API publishes host loopback port 3106 and the gateway publishes host loopback port 5173. Cloudflare Tunnel is managed separately from this Compose file.

For daily work on your machine, use the separate [local development stack](local-development.md). Do not run `deploy/deploy.sh` for the edit/test loop.

## GitHub Environments

Create `development` and `production` environments. The deploy workflow maps pushes to `develop` to development and `v*` tags on `main` to production. Pushes to `main` only run CI; release with `git tag v1.2.3 && git push origin v1.2.3`.

Add these secrets to each environment:

- `DEEZER_ARL_COOKIE`
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_SECRET`
- `KNOWLEDGE_BASE_API_KEY`
- `LASTFM_API_KEY`
- `LASTFM_SHARED_SECRET`
- `MARQUINHOS_API_KEY`
- `MARQUINHOS_CRYPTO_SALT`
- `MARQUINHOS_DECRYPTION_KEY`
- `MARQUINHOS_SECRET_KEY`
- `MARQUINHOS_SPREADSHEET_API_KEY`
- `MARQUINHOS_TOKEN`
- `OPENAI_API_KEY`
- `POSTGRES_PASSWORD`
- `SPOTIFY_CLIENT_SECRET`

Add the required variables `BACKUP_DIR`, `CORS_ORIGINS`, `DISCORD_CLIENT_ID`, `DISCORD_REDIRECT_URI`, `LASTFM_REDIRECT_URI`, `SPOTIFY_CLIENT_ID`, `VITE_API_ORIGIN`, and `VITE_DISCORD_CLIENT_ID`. Configure the remaining optional API and bot settings when their features are enabled.

`VITE_API_ORIGIN` is bundled into the Activity client and must be the public Activity origin. It is not secret. `CORS_ORIGINS` is a comma-separated exact-origin allowlist and must include that origin.

## Runner bootstrap

Install a self-hosted GitHub Actions runner with the `devaneios-runner` label on development and `hostinger-runner` on production. The runner account must be in the Docker group and have Docker Compose v2 available. Create `BACKUP_DIR` with owner access for that account. The API sandbox mirror path defaults to `/opt/marquinhos/sandbox-mirror`; create and maintain it with `apps/api/scripts/sync-sandbox-mirror.sh` under a host timer before deploying the API.

Run the first release with the Deploy workflow’s `all` input. Later `develop` pushes select the changed component automatically, and a release tag selects the components changed since the previous `v*` tag. The first tag deploys everything. To redeploy production manually, dispatch the workflow from the release tag. API deploys write a `pg_dump` custom-format dump (and, until the SQLite volume is removed, a compressed snapshot of it) to `BACKUP_DIR`, retain fourteen days of backups, start PostgreSQL if it is not running, recreate only the API container, and roll back its image if the HTTP health check fails. The API applies pending migrations from `packages/database/drizzle` at startup. Restore a database backup manually only when a migration requires it.

## Cloudflare and Discord

Create one remotely managed Cloudflare Tunnel per deployed environment. A host-level connector reaches the gateway at `http://127.0.0.1:5173`. A separately managed connector container on the `marquinhos` Docker network can use `http://gateway:80`. Use the destination matching your connector placement; this Compose file does not start cloudflared.

In the Discord Developer Portal, map the Activity root to the gateway hostname and map `/api` and `/colyseus` to the same gateway hostname. The gateway routes API and Colyseus requests internally while serving the Activity build for browser routes.

## Rollback

The deploy script retains the previously running image under a `rollback` tag and automatically recreates the failed service from it. Inspect `docker logs marquinhos-api`, `marquinhos-bot`, or `marquinhos-gateway` after a failed workflow. If an API database migration itself must be reversed, stop the API, restore the matching dump with `docker exec -i marquinhos-postgres pg_restore -U marquinhos -d marquinhos --clean --if-exists < BACKUP_DIR/marquinhos-postgres-<timestamp>.dump`, then redeploy the prior image.

## SQLite to PostgreSQL cutover

The import is automatic. Add `POSTGRES_PASSWORD` to the environment's secrets and deploy the API. On boot, after applying migrations and before seeding defaults or serving anything, the API finds the SQLite file at `SQLITE_PATH` (`/app/data/marquinhos.db`) and imports it once:

1. It saves a consistent snapshot next to the source as `/app/data/marquinhos.pre-postgres-<timestamp>.db` and imports from that snapshot. Restore that file to roll back.
2. It copies every table in one transaction, replacing the defaults seeded by earlier boots (`xp_config`, `achievements`, `ai_chat_config`). It refuses if any other table already has rows, and rolls back unless every table's row count matches the source.
3. In the same transaction it writes a row to `legacy_sqlite_import`. Every later boot sees that row and skips the import. The log line `db.legacy_sqlite_imported` carries the snapshot path and per-table counts.

If the import fails, the API does not start and the deploy rolls back to the previous (SQLite) image, whose data is untouched; the failed attempt's snapshot is deleted. Fix the cause and deploy again. The same import can be run by hand with `docker compose -f deploy/docker-compose.yml --env-file deploy/.env run --rm --no-deps api bun /app/packages/database/src/etl/importSqlite.ts /app/data/marquinhos.db`; it also stops if the marker row exists.

After a successful cutover, rolling back to the SQLite image drops anything written to PostgreSQL. Copy the snapshot out of the volume, then retire the legacy path in a later release: remove `SQLITE_PATH` and the `marquinhos-api-data` mount from the compose file, the import call in `apps/api/src/index.ts`, `packages/database/src/etl`, and the `legacy_sqlite_import` table (in a new migration).
