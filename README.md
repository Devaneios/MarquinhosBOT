# marquinhos-activity-client

The iframe frontend for Marquinhos' Discord Activities, built with the
[Embedded App SDK](https://discord.com/developers/docs/activities/overview)
on Vite + React + TypeScript. It talks to
[`marquinhos-api`](../marquinhos-api) for auth (OAuth2 code exchange) and
real-time multiplayer state (WebSocket).

Currently ships one pilot activity, Pong (`src/games/pong`), built to
validate the foundation end-to-end — auth flow, proxy handling, and the
WebSocket transport — rather than as a finished game.

## Architecture

- `src/discordSdk.ts` — the `DiscordSDK` instance, constructed from
  `VITE_DISCORD_CLIENT_ID`.
- `src/hooks/useDiscordAuth.ts` — runs the auth sequence on mount:
  `discordSdk.ready()` → `commands.authorize()` → exchange the code for an
  access token via `marquinhos-api`'s `POST /api/activities/token` →
  `commands.authenticate()` → mint a WS session token via
  `POST /api/activities/ws-session`.
- `src/lib/apiBase.ts` — resolves REST/WS URLs depending on whether the app
  is running inside Discord's Activity proxy (`*.discordsays.com`, requires
  the `/.proxy/` prefix) or in a plain browser tab during local iteration.
- `src/lib/ws.ts` — a small reconnecting WebSocket client wrapping the
  `{ type, payload }` message envelope used by `marquinhos-api`'s realtime
  server.
- `src/games/pong/` — the pilot activity: canvas rendering + keyboard input,
  driven entirely by state broadcasts from the server (the client holds no
  authoritative game state).

## Local development

You need both this app and `marquinhos-api` running:

```sh
# terminal 1 — marquinhos-api
cd ../marquinhos-api
bun run dev   # listens on HTTP_PORT (default 3000)

# terminal 2 — this repo
cp .env.example .env   # fill in VITE_DISCORD_CLIENT_ID
bun install
bun dev       # vite dev server, default port 5173
```

### Wiring it up in Discord

1. In the [Discord Developer Portal](https://discord.com/developers/applications),
   open your application → **Activities** → enable Activities and set up
   **URL Mapping**. You need at least:
   - root prefix (`/`) → your Vite dev server (or the deployed static build)
   - `/api` → `marquinhos-api`'s origin
   - `/ws` → `marquinhos-api`'s origin (same target as `/api`; the
     WebSocket server is mounted on the same HTTP server, just a different
     path — see [`src/realtime/ActivityRealtimeServer.ts`](../marquinhos-api/src/realtime/ActivityRealtimeServer.ts))
2. Set `DISCORD_CLIENT_SECRET` (and the existing `DISCORD_CLIENT_ID`) in
   `marquinhos-api`'s `.env` — the token exchange endpoint needs both.
3. Launch the Activity from a test server's App Launcher. See Discord's
   [local development guide](https://docs.discord.com/developers/activities/development-guides/local-development)
   for the exact portal flow, which changes independently of this repo.

### Entry Point Command

Launching the Activity from the App Launcher needs an Entry Point command
(application command type `PRIMARY_ENTRY_POINT` = 4). Enabling Activities in
the Developer Portal auto-creates one with handler `DISCORD_LAUNCH_ACTIVITY`
(2) — Discord opens the Activity and posts the follow-up message itself, no
code required. Renaming it or switching to `APP_HANDLER` (1, to send that
message yourself) is done via the global application command HTTP endpoints,
not through the bot's normal command registration. See the note in
[`MarquinhosBOT/src/register-slash-commands.ts`](../MarquinhosBOT/src/register-slash-commands.ts).

## Production

`bun run build` produces a static bundle in `dist/`. Where that gets hosted
(and how its origin is wired into the same URL Mapping as above) is a
deployment decision outside this repo's scope for now.
