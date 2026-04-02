# Codebase Review & Fix Plan — MarquinhosBOT + marquinhos-web-api

## Context

A senior-engineer-level review of two repos — the Discord bot (`MarquinhosBOT`) and its REST API backend (`marquinhos-web-api`) — covering all feature flows: commands, events, game system, services, utilities, auth, gamification, scrobbles, wordle, and maze. The goal is to identify and fix bugs, security issues, code quality problems, and structural weaknesses in a module-by-module approach, bot-first.

Issues are grouped by module. Each module is a discrete unit of work. Work through them in order — later modules build on earlier fixes (e.g., game fixes assume GameManager race is fixed first).

---

## Bot Modules (MarquinhosBOT)

### Module 1 — `src/utils/` (errorHandling, httpClient, scrobble)

**Files:** `src/utils/errorHandling.ts`, `src/utils/httpClient.ts`, `src/utils/scrobble.ts`

**Issues to fix:**

- `safeExecute()`: the outer `try/catch` only catches synchronous errors. Async errors are handled by the `.catch()` branch, which is correct, but the wrapping is confusing and doesn't forward arguments from the returned function. Add JSDoc to clarify the contract.
- `sendErrorMessage()`: no rate limiting — a burst of errors triggers a burst of Discord webhook POSTs. Add a simple in-memory debounce/queue (e.g., flush at most once per 5s, batching pending errors).
- `sendErrorMessage()`: `encodeURI(webhookUrl)` is wrong — `encodeURI` is for full URIs; using it on an already-valid webhook URL can corrupt it. Remove `encodeURI`.
- `sendErrorMessage()`: no null-guard on `MARQUINHOS_ERROR_WEBHOOK` before calling — add early return if env var is missing (it already exists but verify).
- `httpClient.ts`: exponential backoff max delay (10s) can exceed the request timeout, making retry attempt moot. Cap backoff at `timeout - 1000ms` or reduce max delay.
- `httpClient.ts`: response body reading (`response.text()`) has no timeout — a slow/huge response can hang indefinitely. Use `AbortController` or a separate timeout.
- `scrobble.ts`: `queue()` and `dispatch()` are empty stubs that return early. Either implement them or delete the file and remove all usages. Currently `queue()` is called from `marquinhos-bot.ts` — this is dead code.

**Verification:** Run `bun run typecheck`. Manually trigger an error to confirm webhook batching works.

---

### Module 2 — Bot core & lifecycle (`src/bot/marquinhos-bot.ts`, `src/index.ts`)

**Files:** `src/bot/marquinhos-bot.ts`, `src/index.ts`

**Issues to fix:**

- **Env validation at startup:** before `client.login()`, validate all required env vars (`MARQUINHOS_TOKEN`, `MARQUINHOS_API_URL`, `MARQUINHOS_API_KEY`, `MARQUINHOS_ERROR_WEBHOOK`, `MARQUINHOS_CLIENT_ID`). Throw with a descriptive message listing missing vars. Fail fast.
- **Timer accumulation in `_initializePlayer`:** the `timers` array is filled on every `playerStart` event but only cleared on the next `playerStart`. If the bot processes many tracks, timers from previous tracks are never cleared. Clear `timers` on `playerFinish` / `playerEmpty` events too, and call `clearTimeout` on each entry.
- **Scrobble fire-and-forget:** `scrobble.create(...).then(() => scrobble.queue())` swallows errors. Wrap in `safeExecute` or a proper `.catch` with logging.
- **Deezer credentials in logs:** verify that `DeezerExtractor` registration does not log credentials. If the library logs the options object, filter `decryptionKey` and `arl` from logs before passing.
- **No shutdown hook:** add `process.on('SIGTERM')` / `process.on('SIGINT')` handlers that clear intervals and timers (player timers, ready.ts intervals) before exiting.

**Verification:** Start bot with a missing env var and confirm it exits with a clear error. Play a track and confirm timers are cleared after track ends.

---

### Module 3 — `src/services/marquinhosApi.ts`

**File:** `src/services/marquinhosApi.ts`

**Issues to fix:**

- **Not a singleton:** every `new MarquinhosApiService()` creates a new `HttpClient` and registers fresh interceptors. Commands that call `new MarquinhosApiService()` at runtime will each have their own interceptor chain. Convert to singleton with a static `getInstance()` method.
- **Constructor side effects:** interceptors registered in constructor; if called twice they'd stack. Singleton pattern fixes this.
- **Update all call sites:** grep for `new MarquinhosApiService()` and replace with `MarquinhosApiService.getInstance()`.

**Files to update at call sites:** `src/bot/commands/games.ts`, `src/bot/commands/level.ts`, `src/bot/commands/achievements.ts`, `src/bot/commands/leaderboard.ts`, and any others found by grep.

**Verification:** Confirm only one interceptor fires per request by adding a log counter; start bot and run two commands in sequence.

---

### Module 4 — Events (`src/bot/events/`)

**Files:** `src/bot/events/ready.ts`, `src/bot/events/guildMemberAdd.ts`, `src/bot/events/messageCreate.ts`, `src/bot/events/voiceStateUpdate.ts`

**Issues to fix:**

**ready.ts:**
- Activity `setInterval` is never stored or cleared. Store the return value and clear it in the shutdown hook added in Module 2.
- Termo word rotation: `setTimeout → setInterval` pattern resets on every bot restart. This means if the bot restarts before midnight, the daily word rotation may be missed or duplicated. Fix: on boot, calculate time to next midnight; if `msUntilMidnight < 0` (already past midnight and word not yet rotated today), rotate immediately. Use a persistent flag (e.g., check the DB `wordle_daily.word_date`) to decide.
- `msUntilMidnightRecife()` timezone math: `recifeOffset - -localOffset` double-negation is fragile. Rewrite using `Intl.DateTimeFormat` to get current Recife time directly, then compute ms to midnight from that.
- Empty `catch` blocks around guild Termo rotation silently hide API failures. Add `logger.warn(...)` inside each catch.
- `as any` cast on `cfgRes.data` — type the response properly.

**guildMemberAdd.ts:**
- Hardcoded IDs (`mainChannelId`, `externalRoleId`, `newcomersChannelId`). Move to env vars (`GUILD_MAIN_CHANNEL_ID`, `GUILD_EXTERNAL_ROLE_ID`, `GUILD_NEWCOMERS_CHANNEL_ID`) or a config table in the DB.
- `member.send()` failure throws a new Error, crashing the event handler. Change to `logger.warn(...)` and return gracefully — DMs disabled is expected for many users.
- `guild.members.fetch()` result not null-checked after fetch.

**messageCreate.ts:**
- `handlePotentialSpam(message)` is not awaited and errors are silently swallowed. Wrap in `safeExecute` or add `.catch(logger.error)`.

**voiceStateUpdate.ts:**
- File is dead code (handler body does nothing). Either implement voice XP or delete the file and remove the event registration in `marquinhos-bot.ts`.

**Verification:** Confirm bot startup doesn't log term rotation errors; confirm `guildMemberAdd` with a user who has DMs disabled doesn't crash.

---

### Module 5 — Game core (`src/game/core/`)

**Files:** `src/game/core/GameManager.ts`, `src/game/core/GameTypes.ts`

**Issues to fix:**

**GameManager.ts:**
- `endSessionWithResult()` race: session is deleted *after* the API call, but if the API call hangs or the process dies, the session is orphaned (never deleted). Worse, a second button press while the API call is in-flight will find the session still active and try to end it again. Fix: mark session as `finishing` at start of `endSessionWithResult()` and check for this state at entry. Delete session before the API call (or use a Set of "in-flight session IDs").
- No concurrency control on player actions: two button presses from the same session arriving simultaneously can both pass the `isFinished()` check before either sets the finished state. Add a `Set<string>` of session IDs currently being processed; if a session is already in-flight, drop the duplicate interaction with a deferred no-op.
- Cleanup `setInterval` stored in `this.cleanupInterval` but never cancelled. Add a `destroy()` method that calls `clearInterval(this.cleanupInterval)` and invoke it in the shutdown hook.

**GameTypes.ts:**
- `isFinished()` checks `data.gameOver || data.finished || data.solved || data.drawn || data.gamePhase === 'finished'` — this is a workaround, not a contract. Add a protected abstract `_isFinished(): boolean` method to `BaseGame` and rewrite `isFinished()` to call it. Each game must implement `_isFinished()` returning its authoritative finished state. Remove reliance on flag names.

**Verification:** Manually trigger a rapid double-click on a game button and confirm no double-finish. Confirm session cleanup interval is cleared on shutdown.

---

### Module 6 — Casino games (`src/game/casino/`)

**Files:** `src/game/casino/blackjack.ts`, `src/game/casino/slots.ts`

**Issues to fix:**

**blackjack.ts:**
- `drawCard()` uses `deck.pop()!` — non-null assertion. If deck is exhausted (very long game), this crashes with an undefined card. Add a check: if deck is empty, reshuffle the discard pile into a new deck. Add a discard pile or simply reshuffle all cards minus cards in play.

**slots.ts:**
- State replacement bug: `this.session.data = { ...newState }` replaces the entire data object before `updatePlayerScore()` is called. If `updatePlayerScore()` throws, data is in the new state but score wasn't applied. Reorder: update score first, then assign new state.

**Verification:** Play Blackjack until deck exhaustion (can be simulated by reducing deck size in a test); play Slots and trigger an error in updatePlayerScore to confirm state consistency.

---

### Module 7 — Knowledge/Words/Strategy/Multiplayer games

**Files:**
- `src/game/knowledge/musicQuiz.ts`
- `src/game/words/secretWord.ts`
- `src/game/strategy/ticTacToe.ts`
- `src/game/multiplayer/speedMath.ts`

**Issues to fix:**

**musicQuiz.ts + speedMath.ts:**
- `this.session.players.sort(...)` mutates the original array in place — subsequent calls to `getGameEmbed()` see players in the sorted order, corrupting display. Replace with `[...this.session.players].sort(...)` in both files.

**musicQuiz.ts:**
- `elapsed` from `Date.now() - startTime` can theoretically exceed `timeLimit * 1000` if the event loop stalls, causing `remaining` to be 0 (clamped). Acceptable. No change needed here; document the clamp behavior.

**secretWord.ts:**
- Win condition race: `data.won = true` and `data.gameOver = true` set before `await this.updateScores()`. If `updateScores()` throws, game appears finished but scores aren't saved. Reorder: call `updateScores()` first, then set `data.won` and `data.gameOver`.
- Wrong word counting `push(word)` twice (intentional but undocumented). Add an inline comment explaining that a wrong-word guess counts double.

**ticTacToe.ts:**
- No turn timeout: if a player doesn't act, the game hangs until the 5-minute session expiry. Add a per-turn timeout (e.g., 60s): after a turn starts, schedule a timeout that auto-forfeits the inactive player. Store the `NodeJS.Timeout` reference in the `GameSession` object inside `GameManager.activeSessions` (runtime Map, not serialized to DB). Clear the stored timeout on each player action and on `endSession()`.

**Verification:** Confirm leaderboard in MusicQuiz shows correct player order after multiple questions. Confirm TicTacToe auto-forfeits inactive player after timeout.

---

### Module 8 — Game handlers (`src/bot/handlers/`)

**Files:** `src/bot/handlers/commandHandler.ts`, `src/bot/handlers/gameButtonHandler.ts`, `src/bot/handlers/gameInteraction.ts`

**Issues to fix:**

**commandHandler.ts:**
- Cooldown `setTimeout` is created but never tracked — no way to cancel it on shutdown. Store all cooldown timers in a `Map<string, NodeJS.Timeout>` and clear them in the shutdown hook.

**gameButtonHandler.ts:**
- The legacy static `STATIC_BUTTONS` dispatch table (lines 24–249) duplicates button configs that games should own. This is a long-term migration: add a migration note and do not add new entries to the static table. Existing games that already implement `getButtonDescriptors()` on `BaseGame` should be removed from the static table.
- `buildAndShowModal()` swallows errors silently. Add `logger.warn(...)` on failure (expired interaction is expected and not an error; other failures should be logged).

**gameInteraction.ts:**
- Generic error messages hide root cause. Allow games to throw a `UserFacingError` class (a new lightweight class extending `Error` with a `userMessage` field). In the catch block, check `instanceof UserFacingError` and use `error.userMessage` as the reply; otherwise use the generic message. This lets individual games surface meaningful errors without leaking internals.

**Verification:** Verify that when a game throws a `UserFacingError`, the user sees the specific message. Verify cooldown timers are cleared on bot shutdown.

---

### Module 9 — High-risk commands

**Files:** `src/bot/commands/anom.ts`, `src/bot/commands/disconnectAll.ts`, `src/bot/commands/moveAll.ts`, `src/bot/commands/audio.ts`, `src/bot/commands/avatar.ts`, `src/bot/commands/chaos.ts`, `src/bot/commands/games.ts`

**Issues to fix:**

**anom.ts:**
- No `await` on `channel.send()` — fire-and-forget. Await it.
- No reply to interaction — Discord requires a response. After `channel.send()` completes, call `interaction.reply({ content: 'Mensagem enviada.', ephemeral: true })`.
- No permission check. Validate bot has `SendMessages` permission in the target channel before sending.
- Unsafe `.get()` — use `.getChannel()`.

**disconnectAll.ts:**
- `defaultMemberPermissions` is set to `0` (everyone). Should require `MoveMembers` permission, same as `disconnect.ts`.
- No cooldown. Add `cooldown: 10`.
- `setChannel(null)` calls are not awaited inside the `.values()` loop. Use `Promise.all()` for all disconnect calls and await the result.
- No reply sent after disconnecting. Add an ephemeral reply with count of users disconnected.

**moveAll.ts:**
- Same `await` issue: `setChannel()` not awaited in loop. Use `Promise.all()`.
- No reply sent after moving. Add reply.
- No cooldown. Add `cooldown: 10`.
- Unsafe `.get()` — use `.getChannel()`.

**audio.ts:**
- `execute` function is synchronous but uses `interaction.reply()` which returns a Promise. Either mark it `async` and `await` the reply, or handle the returned promise.
- `.get()` → `.getString()`.

**avatar.ts:**
- Date math bug in `_getHolidayAvatar()` (and related functions): `startDate.setFullYear(currentDate.getFullYear() + startDate.getFullYear() - 2017)` is wrong. The intent is to project the avatar's month/day into the current year. Fix: parse avatar start/end as month-day strings (`MM-DD`), then construct `new Date(currentYear, month - 1, day)` for comparison.
- Remove `console.log` calls (lines 193, 198). Use `logger.debug(...)` or remove entirely.
- `.get()` casts → typed `.getString()` / `.getUser()`.

**chaos.ts:**
- Track all `setTimeout` return values in an array stored on the interaction or a module-level Map keyed by `interaction.id`. Clear all of them if the interaction is deleted or when the chaos sequence finishes.
- `ChannelType.GuildVoice` enum instead of magic number `2`.

**games.ts:**
- Cooldown check-then-set race: `canUserPlay()` and `setUserCooldown()` are two separate operations. Wrap both in a single operation: check and set atomically using a Map that only sets if key is absent (i.e., check with `has()` and set in the same synchronous block before any `await`).
- Opponent validation happens after `createSession()`. Move all opponent/input validation (lines 286–313 area) to before `createSession()`. Only create the session after all preconditions are verified.
- `createGameInstance()` switch with 20 cases should be a registry map: `const GAME_REGISTRY: Record<string, new (...args) => BaseGame> = { blackjack: Blackjack, ... }`. Replace the switch with `const GameClass = GAME_REGISTRY[gameType]; if (!GameClass) throw ...; return new GameClass(...)`.

**Verification:** Each fixed command: manually test the primary flow and at least one error path (e.g., `anom` to a channel the bot can't write to).

---

### Module 10 — Medium-risk commands

**Files:** `src/bot/commands/admin.ts`, `src/bot/commands/karaoke.ts`, `src/bot/commands/playlist.ts`, `src/bot/commands/recommend.ts`, `src/bot/commands/syncParty.ts`, `src/bot/commands/leaderboard.ts`

**Issues to fix:**

**All commands — `as any` casts:**
- Replace `as any` with typed response interfaces. Add response types to `src/types.d.ts` where missing (e.g., `WordleConfigResponse`, `KaraokeSessionResponse`, `PlaylistResponse`, `RecommendationResponse`, `SyncPartyResponse`). Each type only needs the fields actually used.

**All commands — fragile `"Artist - Title"` split:**
- `karaoke.ts`, `playlist.ts`, `syncParty.ts` all split on `' - '`. Replace with a helper `parseArtistTitle(input: string): { artist: string; title: string } | null` that: (a) splits on the first ` - ` only (`input.split(' - ', 2)`), (b) returns `null` if fewer than 2 parts. Call sites handle `null` with a user-facing error.

**admin.ts:**
- Silent failure when posting to the Termo channel (line 119 area). Add `logger.warn(...)` in the catch.
- Replace `let result: any` with typed variable.

**leaderboard.ts:**
- Sequential Discord user fetches: replace the `for` loop with `Promise.all(entries.map(e => fetchUser(e.userId)))`. Limit concurrency if needed (e.g., 10 at a time via batching).

**recommend.ts:**
- URL string interpolation with `userId` / `guildId` / `genre` that come from user input. While Discord.js provides these as validated strings, add explicit string sanitization (strip whitespace, URL-encode via `encodeURIComponent`) before interpolation.

**Verification:** Confirm leaderboard with 10 entries fetches all users in parallel. Confirm `karaoke.ts` handles `"My Song - Artist - Remix"` without crashing (uses first split only).

---

### Module 11 — Command cleanup

**Files:** `src/bot/commands/music/test.ts`, `src/bot/commands/time.ts`, `src/bot/commands/lastfm.ts`, `src/bot/commands/music/skip.ts`

**Issues to fix:**

- `music/test.ts`: remove this file. It's a debug command with a hardcoded track that should not be in production. Remove from `src/bot/commands/index.ts` export.
- `time.ts`: remove the `// OLEO DE MACACO TIME` debug comment.
- `lastfm.ts`: remove the `dotenv.config()` call at module level. `dotenv` is already initialized in `src/index.ts`; calling it again per-module is wasteful and could mask missing vars.
- `skip.ts`: translate English error messages to Portuguese for consistency with the rest of the bot.

**Verification:** Bot builds and starts cleanly after `music/test.ts` is removed.

---

## API Modules (marquinhos-web-api)

### Module 12 — API infrastructure (`src/index.ts`, `src/middlewares/`)

**Files:** `src/index.ts`, `src/middlewares/botAuth.ts`, `src/middlewares/userAuth.ts`, `src/utils/crypto.ts`

**Issues to fix:**

**src/index.ts:**
- Add a global Express error handler as the last middleware:
  ```ts
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error(err);
    res.status(500).json({ message: 'Internal server error' });
  });
  ```
- Add a 404 catch-all route before the error handler:
  ```ts
  app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
  ```
- Move CORS allowlist to env var: `CORS_ORIGINS=http://localhost:4200,https://marquinhos-74154.web.app`. Parse on startup.

**botAuth.ts:**
- Replace `token !== process.env.MARQUINHOS_API_KEY` with `!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedKey))`. Import Node's `crypto` module. This prevents timing-based API key extraction.

**userAuth.ts:**
- Discord user data is fetched from the Discord API on every authenticated request with no caching. Add an in-process LRU cache (`Map` with TTL, or use `lru-cache`) keyed by decrypted access token, TTL 60s. Cache the user object returned by Discord.
- Token expiry: the `Created-At` and `Expires-In` values stored alongside the token should be checked here. If `Date.now() > createdAt + expiresIn * 1000`, return 401 with `{ message: 'Token expired' }` instead of hitting Discord.

**crypto.ts:**
- Hardcoded salt `'marquinhos-salt'` in `scryptSync`. Move to env var: `CRYPTO_SALT`. Existing tokens will need re-encryption if salt changes — document this migration requirement.

**Verification:** Hit an undefined route — confirm 404. Trigger a controller throw — confirm 500 from global handler. Hit a protected endpoint with an expired token — confirm 401.

---

### Module 13 — Gamification service (`src/services/gamification.ts`)

**File:** `src/services/gamification.ts` (668 lines → split into 3 files)

**Issues to fix:**

**Race condition on XP cooldown:**
- The current flow is: `SELECT xp_cooldowns` → check elapsed → `INSERT/UPDATE xp_cooldowns`. Under concurrent requests, both requests can pass the SELECT check before either writes. Fix using SQLite's capabilities:
  ```sql
  INSERT INTO xp_cooldowns (user_id, guild_id, event_type, last_gain)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(user_id, guild_id, event_type) DO UPDATE SET
    last_gain = CASE
      WHEN (? - last_gain) >= ? THEN excluded.last_gain
      ELSE last_gain
    END
  RETURNING (? - last_gain) >= ? AS allowed;
  ```
  This makes the check-and-set a single atomic SQL statement.

**Achievement JSON condition validation:**
- The `condition` field in the `achievements` table is a JSON string parsed at runtime. If malformed JSON was inserted (e.g., via a direct DB write), `JSON.parse()` throws inside a `try/continue` — the achievement is silently skipped forever. Add a validation step when achievements are seeded/inserted: validate JSON is parseable and matches a known shape.

**File split:**
- Move XP logic (`addXP`, `applyLevelUps`, `ensureUser`, `getXpConfig`, cooldown logic) → `src/services/xp.ts`
- Move achievement logic (`checkAndAwardAchievements`, `unlockAchievement`, `getAchievements`, `getUserAchievements`) → `src/services/achievements.ts`
- Move leaderboard/stats logic (`getLeaderboard`, `getUserGameStats`, `recordGameResult`) → `src/services/leaderboard.ts`
- Keep `gamification.ts` as a thin re-export barrel: `export * from './xp'; export * from './achievements'; export * from './leaderboard';` — this avoids breaking imports in the controller.

**Verification:** Run addXP with 10 concurrent requests (e.g., via a simple load script) and confirm only the first request's XP is applied (cooldown holds for the rest).

---

### Module 14 — User & auth services (`src/services/user.ts`, `src/controllers/auth.controller.ts`)

**Files:** `src/services/user.ts`, `src/controllers/auth.controller.ts`, `src/services/discord.ts`

**Issues to fix:**

**N+1 on top artists/albums/tracks (`user.ts`):**
- `getTopArtists()` queries Last.fm once, then calls `spotifyService.searchArtist(name)` in a sequential loop. Replace with `Promise.all(artists.map(a => spotifyService.searchArtist(a.name)))`. Cap concurrency to 5 simultaneous Spotify calls using a simple semaphore or `p-limit`.

**Last.fm session token stored plaintext:**
- `enableLastfm()` stores the Last.fm session token directly in the `users` table. Encrypt it with `encryptToken()` from `crypto.ts` before storing. Decrypt with `decryptToken()` before use in `scrobbler` and `lastfm` service calls.
- Write a one-time migration script (`migrations/002_encrypt_lastfm_tokens.ts`) that reads all rows in `users` where `lastfm_session_token IS NOT NULL`, encrypts each with `encryptToken()`, and writes back. This migration runs automatically via the migration system added in Module 18.

**CSRF on Last.fm OAuth:**
- `lastfmLoginUrl()` returns the authorization URL but there's no `state` parameter. Before redirecting, generate a random nonce (`crypto.randomBytes(16).toString('hex')`), store it in a short-lived DB record or the response (e.g., a signed cookie), and append `&state=<nonce>` to the URL. On callback (`redirect-lastfm` in the frontend), verify `req.query.state` matches the stored nonce.

**Discord token expiry check in `userAuth.ts`** (covered in Module 12 but the expiry data originates from `auth.controller.ts`):
- Confirm `Created-At` and `Expires-In` response headers are set correctly in `auth.controller.ts:login()`. They are set from the Discord API response — verify the field names map correctly.

**`user.create()` race condition:**
- `SELECT` then `INSERT` is not atomic. Replace with:
  ```sql
  INSERT INTO users (id) VALUES (?) ON CONFLICT(id) DO NOTHING;
  ```
  Remove the prior SELECT check.

**Verification:** Trigger `getTopArtists` and confirm Spotify calls fire concurrently (check timing). Verify Last.fm token is stored encrypted in the DB.

---

### Module 15 — Scrobble & Last.fm (`src/services/lastfm.ts`, `src/services/scrobbler.ts`)

**Files:** `src/services/lastfm.ts`, `src/services/scrobbler.ts`

**Issues to fix:**

**`dispatchScrobble()` — all-or-nothing `Promise.all`:**
- If one user's scrobble fails, `Promise.all` rejects and all scrobbles fail. Replace with `Promise.allSettled(...)` and log/collect the rejected ones. Return partial success info (which users succeeded, which failed).

**Queue deletion before confirmation:**
- `dispatchScrobbleFromQueue()` deletes the queue entry before confirming all scrobbles posted. Move the delete to after `Promise.allSettled` resolves and all settlements are processed. If scrobbling fails for all users, keep the entry in the queue (or mark as `failed` with a retry counter).

**`updateNowPlaying()` errors silently swallowed:**
- In `addToScrobbleQueue()`, `updateNowPlaying()` is called but its errors are caught and ignored. Add `logger.warn('updateNowPlaying failed for user %s: %s', userId, error)` in the catch.

**`scrobble()` no retry on transient errors:**
- Last.fm API can return 500s or network errors. The method has no retry. Add retry with exponential backoff (2 attempts, 1s/2s delay) for 5xx and network errors. Do not retry Last.fm error code 9 (invalid session).

**Verification:** Simulate a failing scrobble for one of two users and confirm the other user's scrobble still succeeds.

---

### Module 16 — Wordle & Maze (`src/services/wordle.ts`, `src/services/maze.ts`)

**Files:** `src/services/wordle.ts`, `src/services/maze.ts`, `src/utils/mazeGenerator.ts`

**Issues to fix:**

**wordle.ts:**
- Hardcoded `UTC-3` timezone offset in `msUntilMidnightRecife()`. Move to env var `WORDLE_TIMEZONE` (default `America/Recife`). Use `Intl.DateTimeFormat` with the timezone to get current local time, compute ms to next midnight.
- No word list exhaustion warning. After `pickNewWord()` filters available words, if the remaining pool drops below 50 words, log a `logger.warn('Wordle word pool running low: %d words remaining')`. If the pool is 0, throw a descriptive error instead of a generic crash.

**maze.ts:**
- No move count limit: a user can make unlimited moves. Add a `max_moves` column (or derive from maze size: `size * size * 2`). When `moves_count >= max_moves`, mark session as `abandoned` and return a "maze failed" state.
- Maze JSON in DB: size-99 maze serializes to ~10KB per row. This is acceptable for current scale. Document the size limit. If scaling is ever needed, store a seed + generation parameters instead of the full grid.

**Verification:** Set `WORDLE_TIMEZONE=America/Recife` and confirm word rotation fires at midnight Recife time. Trigger maze move count limit and confirm session abandonment.

---

### Module 17 — Controllers & Routes

**Files:** All files in `src/controllers/` and `src/routes/`

**Issues to fix:**

**Rename:**
- `src/controllers/scroblle.controller.ts` → `src/controllers/scrobble.controller.ts`. Update import in `src/routes/scrobble.route.ts`.

**Standardize error response format:**
- All controllers must return `{ message: string }` for errors. Grep for `{ error: ... }` and replace with `{ message: ... }`. This is a global search-and-replace.

**Input validation — add to all routes that lack it:**

Priority routes missing validation:
- `POST /gamification/addXP`: validate `eventType` is a known enum value (not just truthy); validate `userId` and `guildId` are 17–19 digit strings.
- `POST /gamification/game-result`: validate `position` is a positive integer ≥ 1; validate `durationMs` is a positive number.
- `POST /wordle/guess`: validate `guess` is alphabetic (`/^[a-zA-Z]+$/`), length 5–12 chars.
- `GET /user/top-artists/:period/:id`: validate `period` is one of the allowed Last.fm period values.
- `GET /gamification/leaderboard`: already validates limit (capped at 25) — confirm this is sufficient.

Implementation: use a small inline validator helper rather than adding a full library dependency, since the validation needs are narrow:
```ts
function validateDiscordId(id: unknown): id is string {
  return typeof id === 'string' && /^\d{17,19}$/.test(id);
}
```

**Verification:** POST to `/gamification/addXP` with `position: -1` — confirm 400. POST with a non-alphanumeric Wordle guess — confirm 400.

---

### Module 18 — Database (`src/database/sqlite.ts`)

**File:** `src/database/sqlite.ts`

**Issues to fix:**

**No migration system:**
- Currently all tables are created with `CREATE TABLE IF NOT EXISTS`. Schema changes (new columns, altered constraints) require manual intervention or downtime. Implement a lightweight migration system:
  - Add a `schema_migrations` table with `(version INTEGER PRIMARY KEY, applied_at INTEGER)`.
  - Write migrations as numbered SQL files or inline functions: `migrations/001_initial.ts`, `migrations/002_add_column.ts`.
  - On startup, run all unapplied migrations in order.
  - The existing schema in `sqlite.ts` becomes migration 001.
  - This is the minimum viable approach without adding a dependency.

**Missing index on `scrobbles_queue`:**
- Add index: `CREATE INDEX IF NOT EXISTS idx_scrobbles_queue_user ON scrobbles_queue(user_id)`.

**No `updated_at` on mutable tables:**
- Add `updated_at INTEGER` to `users`, `user_levels`, and `wordle_sessions`. Set via `DEFAULT (unixepoch())` and update in relevant queries. This enables debugging and future TTL-based cleanup.

**Verification:** Modify the migration runner to add a test column, confirm migration runs once on boot and is skipped on subsequent boots.

---

### Module 19 — Testing (both repos)

**Target files:** New test files in both repos.

**Bot (`MarquinhosBOT`) — Bun test setup:**
- Add `bun test` configuration. Test files: `src/**/*.test.ts`.
- Unit tests to create:
  - `src/utils/errorHandling.test.ts`: test `safeExecute` with sync throw, async rejection, normal completion.
  - `src/bot/validators/voice-channel.test.ts`: mock `interaction` objects; test each validator with valid/invalid state.
  - `src/game/core/GameManager.test.ts`: test `createSession`, `getSession`, `endSession`, concurrency lock, cleanup.
  - `src/game/core/GameTypes.test.ts`: verify `_isFinished()` contract with a mock game.
  - `src/game/casino/blackjack.test.ts`: test deck exhaustion reshuffle.
  - `src/game/knowledge/musicQuiz.test.ts`: test `[...players].sort()` does not mutate original.
  - `src/bot/commands/games.test.ts`: test `createGameInstance` registry, cooldown atomicity.

**API (`marquinhos-web-api`) — Bun test setup:**
- Add `bun test` configuration. Test files: `src/**/*.test.ts`.
- Unit tests to create:
  - `src/services/gamification.test.ts` (or `xp.test.ts` post-split): test XP cooldown atomicity, level-up formula, achievement unlock conditions.
  - `src/services/wordle.test.ts`: test `computeFeedback()` algorithm against known Wordle cases (exact match, present, absent, duplicate letters).
  - `src/utils/crypto.test.ts`: test encrypt → decrypt round trip; test tampered ciphertext returns null.
  - `src/middlewares/botAuth.test.ts`: test valid key, invalid key, missing key.
- Integration tests (using a `:memory:` SQLite DB):
  - `src/routes/gamification.integration.test.ts`: POST `/gamification/addXP` → verify response, verify DB row, verify cooldown on second call.
  - `src/routes/wordle.integration.test.ts`: submit correct guess, submit wrong guess, verify session state.
  - `src/routes/auth.integration.test.ts`: mock Discord service, test login/token flow.

**Verification:** `bun test` passes with no failures in both repos.

---

## Verification

**Per-module:** Each module has its own verification step listed above.

**Full system verification:**
1. `bun run typecheck` passes in both repos.
2. `bun run lint` passes in both repos.
3. `bun test` passes in both repos.
4. Bot starts with all required env vars set, logs clean startup with no warnings.
5. Bot starts with a missing required env var and exits with a clear error listing the missing var.
6. Discord commands respond correctly end-to-end (ping, level, games play).
7. API health check returns 200; hit a bad route → 404; hit a protected route without auth → 401.
