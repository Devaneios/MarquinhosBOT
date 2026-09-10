# Local development

The development stack runs on your machine. Docker provides Bun 1.4.2 and the
native dependencies used by the bot; you do not need to install those libraries
on the host. A host Bun installation is needed for the root commands. Docker
Compose must support `env_file.required` (Compose 2.24 or newer).

## Configure once

Use a separate Discord development application and a dedicated test text
channel. Keep the same application ID in all three app environment files.

Create any missing files from their examples; preserve existing credentials:

| File                 | Example                      | Required local settings                                                           |
| -------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| `apps/api/.env`      | `apps/api/.env.example`      | Discord client ID/secret/bot token, shared API key, encryption secret, OpenAI key |
| `apps/bot/.env`      | `apps/bot/.env_sample`       | Development bot token/client ID and the same shared API key                       |
| `apps/activity/.env` | `apps/activity/.env.example` | Development `VITE_DISCORD_CLIENT_ID`                                              |
| `dev/.env`           | `dev/.env.example`           | Public HTTPS origin, test channel ID, host ports, existing sandbox mirror path    |

In `dev/.env`, set `DEV_TEST_CHANNEL_ID` to the test channel's Discord ID.
Set `SANDBOX_MIRROR_PATH` to an existing absolute host path containing the source
mirror you want AI code-execution tools to read. The sibling sandbox containers
resolve this path on the Docker host, not inside the API container. Do not use
the live working checkout, which contains credentials. The old mirror-sync
script targets legacy repositories and is not run by this development workflow.

Keep the existing tunnel token in `dev/.env` as `CLOUDFLARE_TOKEN`. This file is
gitignored; keep it private. Compose passes the token to the `cloudflared`
container via its `tunnel run --token` argument — no other service receives it.

API and bot configuration is read from their respective `.env` files. The old
root `.env` is not used by the development commands. Compose explicitly sets
`NODE_ENV=development`, the container URLs, and the SQLite path. After changing
an app environment file, restart `bun run dev` so Compose recreates the affected
container. In Docker, `localhost` refers to that container; the bot reaches the
API at `http://api:3000`.

## Tunnel and Discord

In Cloudflare, edit the existing tunnel's public hostname route:

| Setting         | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| Public hostname | `marquinhos-local.frois.net.br`, or your `DEV_PUBLIC_ORIGIN` hostname |
| Service         | `http://activity:5173`                                                |

Stop the old manual cloudflared process before using the Docker connector.
Running connectors with different origin destinations can produce inconsistent
results. API, Activity, and the tunnel share the `marquinhos-dev` Compose network.

In the development application's Discord Developer Portal, enable Activities
and map `/` to `marquinhos-local.frois.net.br` without a protocol. Remove
overlapping mappings that route `/api` or `/colyseus` to other origins. A single
root mapping sends frontend, API, and multiplayer requests through Vite.
Disable Application URL Override when using the tunnel.

Enable the bot's Guild Members and Message Content privileged intents, install
the development application in your Discord server, and grant it access to the
test channel and its threads. Enable the Activity's supported platforms. Launch
it from the development Activity shelf in a server voice channel.

These portal settings are separate from repository configuration; see
[Discord local development](https://docs.discord.com/developers/activities/development-guides/local-development).

## Daily loop

```sh
bun run dev:doctor
bun run dev
```

The doctor reports unavailable services before the first startup; configuration
checks should pass. Stop existing host API/Vite processes on ports 3000 and 5173
before starting containers, or choose different `DEV_API_PORT` and
`DEV_ACTIVITY_PORT` values. Container ports and the tunnel target stay fixed.

Vite serves the Activity, proxies `/api/*` unchanged, and forwards
`/colyseus/*` HTTP/WebSocket traffic after removing that prefix. Development
browser clients use their frontend origin; Discord clients use its `/.proxy/`
URLs. `VITE_API_ORIGIN` is only used by production builds outside Discord.

Edit source normally. API and bot use Bun watch; Activity uses Vite hot updates.
Dependency/package changes and API word-list changes require an image rebuild;
restarting `bun run dev` rebuilds changed layers. Source directories are mounted
read-only inside containers, with dependencies retained in the image.

API restarts interrupt in-memory multiplayer rooms. Frontend changes affecting
the Discord SDK handshake can require closing and relaunching the Activity.

The development bot uses existing `/dev-*` command names. It accepts messages,
commands, autocomplete, buttons, and modals only in the test channel or its
threads. AI mentions and reactions follow the same rule. Scheduled announcements
and guild-member actions are disabled. Commands explicitly invoked in the test
channel retain their normal effects, including music/voice and admin actions.

Register slash commands explicitly when their definitions change:

```sh
bun run dev:register
```

This uses the existing registration implementation for the development app;
registration replaces that application's command list. The Activity entry-point
configuration is managed separately in Discord.

Ctrl+C stops the foreground stack. `bun run dev:down` removes its containers and
network while retaining the development SQLite volume. It does not remove
production data. This workflow starts with a fresh database and never imports
production state automatically.

## Test the full system

```sh
bun run dev:test
bun run dev:doctor
```

The test command builds the current checkout and runs configuration tests,
real Vite/Express/Colyseus gateway smoke tests, and the workspace test suites in
a disposable container. It uses dummy credentials and temporary SQLite storage;
Discord login and the tunnel are not needed. Gateway tests run outside the
Activity's happy-dom browser mocks so they exercise real network sockets.

For live acceptance, use two Discord accounts to authenticate, join the same
game room, exchange moves, and reconnect. Test a `/dev-*` command, an AI mention,
and an AI thread reply in the test channel. Check that the bot ignores messages
and rejects commands elsewhere. Edit Activity styling and verify hot updates;
edit API/bot code and verify watcher restarts. Stop/start the stack and verify
stored game data remains.

AI code execution requires the Docker socket, `marquinhos-sandbox:dev`, and the
configured mirror directory. `bun run dev` builds that sandbox image. Spotify,
Last.fm, Deezer, Google Sheets, and the knowledge-base service need their own
credentials and reachable URLs before those integrations can be tested. Configure
their callback URLs in the provider dashboards where applicable; the Activity's
OAuth code exchange does not use the legacy web-login callback.

Browser SDK mocks are useful for UI work, but do not implement complete guild
authentication or multi-user browser testing. Use Discord for full gameplay.

## Troubleshooting

| Symptom                                      | Check                                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| Tunnel `/` returns Express `Route not found` | Cloudflare service must be `http://activity:5173`, not the API                    |
| Vite says hostname is not allowed            | `DEV_PUBLIC_ORIGIN` must contain the tunnel hostname; restart Activity            |
| API request returns HTML                     | Request must reach the Vite API proxy, not an old static gateway                  |
| Bot never becomes ready                      | Token, application ID, intents, channel access, and bot logs                      |
| Activity auth fails                          | Matching dev app IDs, active API client secret and bot token, Discord URL mapping |
| Room join fails                              | `/colyseus/` HTTP and WebSocket forwarding; inspect API and Activity logs         |
| Sandbox execution fails                      | Docker socket permissions, development sandbox image, absolute host mirror path   |
| Port occupied                                | Stop the existing server or change the host port in `dev/.env`                    |

Inspect combined or service-specific logs with
`docker compose --env-file dev/.env -f dev/compose.yml logs -f api bot activity cloudflared`.
Never publish the fully rendered Compose environment or credentials in logs.
