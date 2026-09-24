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

- `src/discord/` owns Discord SDK access, authentication, participant lookup, and Activity-specific hooks. `index.html` loads `src/discord/auth.ts` before the React entrypoint so the Discord handshake can start independently of React mounting.
- `src/rooms/` owns the room lobby, in-room header and view, room HTTP calls, and queue eligibility.
- `src/realtime/` owns game-scoped WebSocket sessions, Colyseus connection lifecycle, and the shared connection used by room-based multiplayer.
- `src/navigation/` owns deep-link intent claiming and navigation.
- `src/games/registry.ts` collects the game descriptors. Each `src/games/<game>/index.ts` is the descriptor entry point, with that game's routes, screens, hooks, and rendering code kept in its folder.
- `src/lib/` contains shared HTTP, URL, logging, and styling helpers. `src/i18n/` contains translation setup and locale resources.

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
