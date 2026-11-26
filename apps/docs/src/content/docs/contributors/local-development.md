---
title: Local development
description: Configure and troubleshoot the API, bot, and Activity development stack.
---

Use a separate Discord application and a dedicated test channel. Install the host tooling listed in the repository runbook, then install workspace dependencies with `pnpm install --frozen-lockfile`. Docker Compose supplies PostgreSQL, Redis, Bun, and the bot's native dependencies. [Development runbook](https://github.com/Devaneios/MarquinhosBOT/blob/main/docs/local-development.md) · [Compose services](https://github.com/Devaneios/MarquinhosBOT/blob/main/dev/compose.yml)

| Configuration        | Purpose                                                                                                                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API environment      | Set the Discord application ID, secret, and bot token for OAuth and membership checks. The shared API key authenticates bot calls. The encryption secret protects application credentials. Use a separate OpenAI credential when testing AI features. |
| Bot environment      | Use the development bot's token and application ID. Its API key must match the API, and Compose supplies its internal API URL.                                                                                                                        |
| Activity environment | Set `VITE_DISCORD_CLIENT_ID` to the same development application ID. Local and embedded requests use the frontend proxy.                                                                                                                              |
| Dev environment      | Set the test channel ID, public HTTPS origin, tunnel token, and existing sandbox mirror path. The host defaults are API port 3000 and Activity port 5173.                                                                                             |

Use the checked-in environment examples for names and options. Keep real credentials in the ignored environment files. The API and bot default `WORDLE_TIMEZONE` to `America/Recife`. Set both together when exercising a different calendar. [API example](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/.env.example) · [Bot example](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/bot/.env_sample) · [Activity example](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/activity/.env.example) · [Dev example](https://github.com/Devaneios/MarquinhosBOT/blob/main/dev/.env.example) · [Wordle timezone](https://github.com/Devaneios/MarquinhosBOT/blob/main/docs/wordle-operations.md)

## Launch from Discord

1. Point the HTTPS tunnel at `http://activity:5173` on the Compose network.
2. Enable Activities and supported platforms in the Discord Developer Portal. Map `/` to your public hostname. Remove overlapping `/api` and `/colyseus` mappings and disable Application URL Override when using the tunnel.
3. Enable the bot's Guild Members and Message Content intents. Install the development app in the test server and grant access to the test channel and its threads.
4. Run `pnpm run dev:doctor`, then `pnpm run dev`. Use `pnpm run dev:register` when the development slash commands need updating. Open the Activity from a server voice channel.

Vite forwards `/api/` unchanged and strips the `/colyseus/` prefix before forwarding matchmaking and WebSocket traffic. Embedded clients use Discord's `/.proxy/` URLs. Launch from Discord with two accounts to verify the actual authentication and room flow. [Portal and tunnel setup](https://github.com/Devaneios/MarquinhosBOT/blob/main/docs/local-development.md) · [Vite proxy](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/activity/vite.config.ts) · [Activity API routing](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/activity/src/platform/api/apiBase.ts)

## Seed and troubleshoot

The development stack starts with its own PostgreSQL database. The API dev command prepares the development Wordle data before starting Nest. Rebuild the guess bank when changing the accepted word files and rebuild the API image when changing files copied into it. The development volume survives `pnpm run dev:down`. The `pnpm run dev:test` workflow uses disposable databases and dummy credentials to exercise the gateway and test suites. [API dev command](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/package.json) · [Wordle seed preparation](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/scripts/prepareDevelopmentWordle.ts) · [Development test loop](https://github.com/Devaneios/MarquinhosBOT/blob/main/docs/local-development.md)

- **Ports already in use.** Stop the other local processes or change `DEV_API_PORT` and `DEV_ACTIVITY_PORT`. The tunnel still targets Vite on the Compose network. [Compose port mappings](https://github.com/Devaneios/MarquinhosBOT/blob/main/dev/compose.yml)
- **The iframe loads and API calls fail.** Check the root Discord mapping, tunnel destination, and development application ID. After changing env files, restart the stack so Compose recreates the affected service. [Tunnel and environment troubleshooting](https://github.com/Devaneios/MarquinhosBOT/blob/main/docs/local-development.md)
- **A room disappears after an API restart.** Relaunch or rejoin the game. The active room lives in the API process. Daily Wordle restores persisted board state after rejoining. [Colyseus host](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/realtime/game-server.service.ts) · [Wordle room state](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/realtime/adapters/wordleAdapter.ts)
