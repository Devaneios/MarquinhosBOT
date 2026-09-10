# marquinhos-activity-client

The iframe frontend for Marquinhos' Discord Activities, built with the
[Embedded App SDK](https://discord.com/developers/docs/activities/overview)
on Vite + React + TypeScript. It talks to
[`marquinhos-api`](../marquinhos-api) for auth (OAuth2 code exchange) and
real-time multiplayer state (WebSocket).

Pong (`src/games/pong`), Wordle (`src/games/wordle`) and Cards
(`src/games/cards`) are real activities, each backed by a Colyseus room on
`marquinhos-api`. Cards is a generic card-table renderer driven entirely by
server-pushed, per-player-masked state and a server-supplied list of legal
moves — it has no game rules of its own, only a pluggable `ruleset` id (taken
from the route, `/games/cards/:ruleset`, defaulting to `truco`).

Adding another card game means a new `GameDefinition` on the server plus, at
most, an entry in `src/games/cards/rulesets/presentation.tsx` — the one place
anything game-specific lives on the client (move labels, HUD, seat names). A
ruleset with no entry there still plays; it just renders raw move ids. The table
itself never branches on which game it is showing.

## Architecture

- `src/discordSdk.ts` — the `DiscordSDK` instance, constructed from
  `VITE_DISCORD_CLIENT_ID`.
- `src/hooks/useDiscordIdentity.ts` — runs the auth sequence on mount:
  `discordSdk.ready()` → `commands.authorize()` → exchange the code for an
  access token via `marquinhos-api`'s `POST /api/activities/token` →
  `commands.authenticate()`.
- `src/games/shared/activitySession.ts` — mints a game-scoped WS session
  token (`POST /activities/ws-session`) and its matching Colyseus room key;
  called per-game (e.g. from `usePongSession`/`useWordleSession`) rather
  than once at the top of the identity hook.
- `src/games/shared/useColyseusRoom.ts` — connects to the game's Colyseus
  room with `@colyseus/sdk`, forwards every room message to the caller, and
  tracks connection state (`connecting`/`connected`/`disconnected`/`error`)
  so a game can surface a "connection lost" indicator if the socket drops
  mid-session. Used by every game with realtime state (Pong, Wordle).
- `src/lib/apiBase.ts` — resolves REST/Colyseus URLs depending on whether
  the app is running inside Discord's Activity proxy (`*.discordsays.com`,
  requires the `/.proxy/` prefix) or in a plain browser tab during local
  iteration. `colyseusUrl()` gives the single base URL `@colyseus/sdk`'s
  `Client` needs (it does its own matchmaking/room routing from there).
- `src/games/pong/` — canvas rendering (Pixi.js) + keyboard input, driven
  entirely by state broadcasts from the server (the client holds no
  authoritative game state).
- `src/games/wordle/` — a solo realtime puzzle against the guild's daily
  word.

## Local development

Run the full development stack from the monorepo root with `bun run dev`.
See [local development](../../docs/local-development.md) for environment files,
Docker, tunnel routing, Discord URL mapping, and testing.

The frontend proxies API and Colyseus traffic through Vite during development.
Use `bun run dev:test` at the root for isolated workspace and gateway tests.
Browser mocks support UI iteration; use Discord for full authentication and gameplay.

## Production

The release gateway serves the Activity build and proxies API/multiplayer traffic.
See [deployment](../../docs/deployment.md). `deploy/deploy.sh` is not used for
daily development.
