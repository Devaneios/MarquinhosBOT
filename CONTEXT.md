# MarquinhosBOT domain glossary

## Wire seams

**Endpoint contract**: the single definition of one HTTP endpoint (method, path, request params/query/body, and response schema per status) in `@marquinhos/contracts/http`. The API validates and responds through it; the bot and activity derive their client types from it. Never hand-write a response type on either side.

**Game protocol**: the per-game set of client→server and server→client messages, as zod discriminated unions on `type`, in `@marquinhos/contracts/activity`. Sessions send through it; the activity dispatches through it.

**Wire codec**: a binary encoder/decoder pair for a Game protocol whose state is too hot for JSON (currently only Pong). The enum tables it indexes into are part of the wire format.

## Realtime

**Match room**: the single Colyseus room (`'match'`) every activity client joins. It picks a Room adapter by game id.

**Room adapter**: the per-game module behind the Match room that builds the game's session and routes its messages. One per game, registered by `createAdapterRegistry()` in `apps/api/src/realtime/adapters/registry.ts` with dependencies supplied by `RealtimeModule`.

**Session**: the server-side, per-match game state holder that wraps a domain engine and emits Game protocol messages.

## Wordle persistence

**Global game**: one answer and one player session per calendar date, shared across Discord communities. The session identity is `(user_id, word_date)`; a guild ID is still required when recording community participation, attribution, announcements, and community-scoped views.

**Legacy history**: the original v0.0.3 guild-scoped sessions and day answers. They remain stored as read-only provenance. Each old game keeps its own identity; a missing historical answer stays unknown and is never copied to a shared global board.

**Community participation**: a user's dated presence in a guild. It drives community rankings and features while the game answer and player session stay global.

**Cutover receipt**: the verified source tag, cutoff date, and preservation digest written after the standalone cutover transaction succeeds. API startup requires the receipt before catalog writes, draft settlement, or maintenance.

**Streak carryover**: the saved current/best streak and last solved date at cutover. New global sessions extend the old streak through consecutive dates; a genuine gap expires its current run while retaining its best value.
