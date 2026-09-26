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

`src/architecture.test.ts` enforces the dependency direction below; imports use the `@/` alias for `src/`.

- `src/app/` owns entrypoints, the router, deep-link navigation, the dev console and the boot scripts `index.html` loads. `index.html` loads `src/platform/discord/auth.ts` before the React entrypoint so the Discord handshake can start independently of React mounting.
- `src/platform/` wraps the outside world: `discord/` (SDK, auth, participants, Activity hooks), `api/` (HTTP helpers and endpoints) and `realtime/colyseus/` (connection lifecycle, `useColyseusRoom`, and the `RoomConnectionContext` a room shares with its board).
- `src/features/` holds non-game product features: `hub/` and `rooms/` (lobby, in-room header and view, room HTTP calls, the room connection provider).
- `src/games/registry.ts` lists every game. Each `src/games/<game>/index.ts` is that game's manifest (`GameModule`: id, status, lazy `Game` and optional `RoomBoard`); the app mounts it at `/games/<game>/*`, and a game with sub-menus declares its own descendant routes. Inside a game, `session/` holds the WS session and message reducer, `components/` the React UI (a `Board` owns a connection), and `rendering/` pure canvas renderers. Nothing outside a game imports past its `index.ts`, and games never import each other.
- `src/games/shared/` is client infrastructure common to games: the game shell, keyboard, WS session minting and the letter-feedback palette.
- `src/shared/` contains generic helpers (`cn`, `devlog`). `src/i18n/` contains translation setup and locale resources, with per-game namespaces under `locales/pt-BR/games/`.

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
