# MarquinhosBOT domain glossary

## Wire seams

**Endpoint contract**: the single definition of one HTTP endpoint (method, path, request params/query/body, and response schema per status) in `@marquinhos/contracts/http`. The API validates and responds through it; the bot and activity derive their client types from it. Never hand-write a response type on either side.

**Game protocol**: the per-game set of client→server and server→client messages, as zod discriminated unions on `type`, in `@marquinhos/contracts/activity`. Sessions send through it; the activity dispatches through it.

**Wire codec**: a binary encoder/decoder pair for a Game protocol whose state is too hot for JSON (currently only Pong). The enum tables it indexes into are part of the wire format.

## Realtime

**Match room**: the single Colyseus room (`'match'`) every activity client joins. It picks a Room adapter by game id.

**Room adapter**: the per-game module behind the Match room that builds the game's session and routes its messages. One per game, registered in `realtime/adapters/registry.ts`.

**Session**: the server-side, per-match game state holder that wraps a domain engine and emits Game protocol messages.
