# Deployment

The deployment unit is `deploy/docker-compose.yml`. It runs the API, bot, and static Activity gateway on a Docker network. The API publishes host loopback port 3106 and the gateway publishes host loopback port 5173. Cloudflare Tunnel is managed separately from this Compose file.

For daily work on your machine, use the separate [local development stack](local-development.md). Do not run `deploy/deploy.sh` for the edit/test loop.

## GitHub Environments

Create `development` and `production` environments. The deploy workflow maps `develop` to development and `main` to production.

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
- `SPOTIFY_CLIENT_SECRET`

Add the required variables `BACKUP_DIR`, `CORS_ORIGINS`, `DISCORD_CLIENT_ID`, `DISCORD_REDIRECT_URI`, `LASTFM_REDIRECT_URI`, `SPOTIFY_CLIENT_ID`, `VITE_API_ORIGIN`, and `VITE_DISCORD_CLIENT_ID`. Configure the remaining optional API and bot settings when their features are enabled.

`VITE_API_ORIGIN` is bundled into the Activity client and must be the public Activity origin. It is not secret. `CORS_ORIGINS` is a comma-separated exact-origin allowlist and must include that origin.

## Runner bootstrap

Install a self-hosted GitHub Actions runner with the `devaneios-runner` label on development and `hostinger-runner` on production. The runner account must be in the Docker group and have Docker Compose v2 available. Create `BACKUP_DIR` with owner access for that account. The API sandbox mirror path defaults to `/opt/marquinhos/sandbox-mirror`; create and maintain it with `apps/api/scripts/sync-sandbox-mirror.sh` under a host timer before deploying the API.

Run the first release with the Deploy workflow’s `all` input. Later pushes select the changed component automatically. API deploys create a compressed volume snapshot in `BACKUP_DIR`, retain fourteen days of snapshots, recreate only the API container, and roll back its image if the HTTP health check fails. Restore a database snapshot manually only when a migration requires it.

## Cloudflare and Discord

Create one remotely managed Cloudflare Tunnel per deployed environment. A host-level connector reaches the gateway at `http://127.0.0.1:5173`. A separately managed connector container on the `marquinhos` Docker network can use `http://gateway:80`. Use the destination matching your connector placement; this Compose file does not start cloudflared.

In the Discord Developer Portal, map the Activity root to the gateway hostname and map `/api` and `/colyseus` to the same gateway hostname. The gateway routes API and Colyseus requests internally while serving the Activity build for browser routes.

## Rollback

The deploy script retains the previously running image under a `rollback` tag and automatically recreates the failed service from it. Inspect `docker logs marquinhos-api`, `marquinhos-bot`, or `marquinhos-gateway` after a failed workflow. If an API database migration itself must be reversed, stop the API, restore the corresponding archive from `BACKUP_DIR` into the `marquinhos-api-data` volume, then redeploy the prior image.
