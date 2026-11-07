# NestJS migration log

## Phase 0: baseline and safety net

**Status: Phase 0 through Phase 8 complete; final gates passed.**

- Branch: `refactor/api-nestjs` (created from `main`, which was two commits ahead of `origin/main`).
- Initial baseline: `pnpm run dev:test` exited 1 because all five gateway assertions passed but its `afterAll` hook timed out at 5 seconds. Diagnostic instrumentation showed 12 pending Vite client-environment transform requests; `vite.close()` waits for those requests.
- User-authorized test-only exception D5: `apps/activity/devGateway.test.ts` now awaits `vite.waitForRequestsIdle()` before closing Vite. This drains the transforms started by the HTML requests and leaves the production Activity code unchanged. The five gateway tests passed locally on Bun 1.4.3, then passed in the pinned Docker environment.
- Baseline environment: Bun 1.4.2 in Docker, PostgreSQL 17 Alpine, Docker 29.9.1. The pre-existing development stack was healthy.
- Baseline command: `pnpm run dev:test`; exit code 0.
- `dev/config.test.ts`: 2 passed, 0 failed.
- `apps/activity/devGateway.test.ts`: 5 passed, 0 failed.
- API suite before the Phase 0 safety-net tests: 1748 passed, 0 failed across 188 files.
- API suite with the new route-manifest and HTTP-parity tests: 1750 passed, 0 failed across 189 files.
- Bot suite: 257 passed, 0 failed across 45 files.
- Activity suite: 291 passed, 0 failed across 73 files.
- `apps/api` typecheck passed.
- `pnpm run typecheck` passed across all 9 workspace packages.
- `pnpm run lint` passed across all 9 workspace packages. Existing warnings remain in unchanged `apps/bot` tests and Activity UI components; there were no errors.
- Route manifest: 97 routes, 97 contracts, one-to-one; no unclassified middleware, unmatched routes, or unmatched contracts.
- Express golden file: 201 probes. All 97 routes have a no-authorization response; protected routes also have wrong-bearer cases where safely testable, and eligible contract-validated routes have authenticated empty-body cases. Thirteen wrong-token probes are explicitly skipped because the Activity verifier can call Discord.
- Golden determinism gate: a second capture to `/tmp/express-golden-second.json` matched `tests/parity/express-golden.json` byte-for-byte.
- Parity includes unmatched path, health, privacy policy, allowed and denied CORS origins, Discord login URL, and a 21st request rate-limited across two Activity routes.
- Express baseline: `bun run bench`, Bun 1.4.2 in a Linux arm64 Docker container (kernel `7.0.14-linuxkit`), Docker 29.9.1, on a Darwin arm64 host running Bun 1.4.3. PostgreSQL 17 Alpine was a fresh disposable database with migrations/defaults initialized, then dropped. Autocannon used 10 connections for 30 seconds per target, with guild ID `111111111111111111` and the dummy API key `test-key`.
  - `wordle validate`: 224,251 requests, average 7,476.1 req/s, p50 1 ms, p99 4 ms, average throughput 4.21 MB/s; 224,251 2xx, no errors/timeouts.
  - `wordle guess`: 18,173 requests, average 605.8 req/s, p50 13 ms, p99 39 ms, average throughput 8.19 MB/s; 5,803 2xx and 12,370 4xx, no 5xx/errors/timeouts. The benchmark cycles both 5- and 6-letter words against one daily puzzle length, so the 4xx responses are expected for length mismatches. This route also writes participation/session state in a transaction and serializes concurrent requests on the same guild/day row; that database work is the likely throughput limit. The validate route reads the daily word and checks the cached word bank, explaining its much lower latency.

## Decisions and audits

- **D5 — test-only Activity teardown:** wait for Vite's pending client transforms before closing the dev server. The user explicitly authorized this test-only `apps/activity` change to unblock the baseline; record it as the sole exception to the zero-diff app/activity gate.
- **D1 — parser error responses:** malformed JSON now returns 400 `{ "message": "Invalid JSON body" }`, and oversized JSON returns 413 `{ "message": "Request body too large" }`. Bun 1.4.2 drops the parser `SyntaxError` cause while Nest maps it, so the filter recognizes Bun's parser message. The original Express golden is unchanged.

- Phase 0 parity suite removes `RateLimit-Policy` from header comparisons because D2 explicitly permits its absence after migration. The original Express golden retains the captured header. Volatile `RateLimit-Reset` and `Retry-After` values are represented by stable placeholders.
- The benchmark's single-guild load is intentionally retained for the after-migration comparison; do not tune the benchmark or the application between runs.

## Phase 1: Nest shell hosting the old routers

- Installed NestJS 12 runtime/testing packages at pinned compatible versions, added decorator metadata settings, configured the Nest build externals, and switched the API entry point and Docker command to `src/main.ts`.
- Added root/config/database/http/logging/filter/startup/jobs/realtime modules and kept the old routers mounted through `legacyRoutes.ts` for the strangler phase.
- Parity after the shell: `tests/parity/http-parity.test.ts` passed, 2 tests / 197 assertions, against the unchanged golden. The helper uses the `APP_FILTER` registration from `HttpInfrastructureModule`.
- Workspace checks: `pnpm run typecheck`, `pnpm run lint`, and `pnpm run build` passed. Existing warnings remain in unchanged bot tests and Activity UI files.
- Full development suite: `bun run dev:test` exited 0. It ran 2 dev config tests, 5 Activity gateway tests, 1,750 API tests across 189 files, 257 bot tests across 45 files, and 291 Activity tests across 73 files.
- Runtime smoke test: started the Nest API in production mode in Docker against a fresh disposable PostgreSQL database named `nestjs_phase1`. Startup completed migrations/default seeding and the health endpoint returned `200 {"status":"ok"}`.
- Colyseus smoke test: minted a signed local `ws-session` token and joined the `match` room over the same HTTP server. During the Alpine image SIGTERM check, the client was connected; the server closed it and exited with code 0 in 0.17 seconds.
- Missing-required-secret smoke test: production startup with `MARQUINHOS_API_KEY` empty exited with code 1 during ConfigModule validation, before binding a port.
- Alpine artifact: `docker build -f apps/api/Dockerfile -t marquinhos-api-nest:phase1 .` succeeded. Its image healthcheck reported healthy and `/api/health` returned `200 {"status":"ok"}`.
- Compatibility note: the prompt's Nest 12 `req.route` assumption does not hold with the shipped Express 5 adapter: its generated not-found wildcard sets `req.route`. `ApiExceptionFilter` therefore also recognizes Nest's generated `Cannot METHOD URL` 404 and still preserves 404 exceptions thrown by matched handlers.

## Phase 2: Cross-cutting building blocks

- Added `BotAuthGuard`, `ActivityAuthGuard`, `GuildMemberGuard`, composed auth/rate-limit decorators, `CurrentUser`, `ContractPipe`/`ContractInput`, `OnRouteError`, `RouteErrorInterceptor`, and the shared activity throttler guard. The global filter maps malformed JSON and oversized bodies to the approved D1 responses.
- Moved health and privacy policy onto Nest controllers and removed their legacy router mounts. The old Express router modules remain only for Phase 0 manifest generation until the final migration cleanup.
- Ported `botAuth.test.ts` and `guildMembership.test.ts` to Nest HTTP tests. Their prior status and membership-call assertions remain, with exact response bodies asserted as well.
- Focused tests cover contract error aggregation, authenticated user attachment, guard outcomes, route-error messages, the two-route throttle bucket, and both D1 parser responses. `tests/parity/http-parity.test.ts` passed against the unchanged golden.
- Full `bun run dev:test` exited 0: 2 dev config tests, 5 Activity gateway tests, 1,758 API tests across 191 files, 257 bot tests across 45 files, and 291 Activity tests across 73 files.
- Workspace gates passed: `pnpm run typecheck`, `pnpm run lint`, and `pnpm run build`. Existing bot and Activity lint warnings remain unchanged.

## Phase 3: Identity and integrations

- Move-only step completed for the crypto helper, Discord/Last.fm/Spotify integrations, parser/scrobbler/User services, and auth/user/scrobble controllers. The codemod rewrites relative and tsconfig-alias imports across `src`, `tests`, and `scripts`; no runtime logic changed in this step.
- The first codemod pass exposed that extensionless relative specifiers need to be normalized before matching the move map. The codemod now normalizes source paths and safely reruns after files have moved; the contract tests' dynamic imports resolve to the new locations.
- Move-step checks: API typecheck and lint passed. `pnpm test` was also attempted directly, but the host had no PostgreSQL listener on `127.0.0.1:5432`; this was an environment setup failure, not a test assertion failure. The repository's disposable test runner then passed: 2 dev config tests, 5 Activity gateway tests, 1,758 API tests across 191 files, 257 bot tests across 45 files, and 291 Activity tests across 73 files. The API suite includes the unchanged parity goldens.
- Singleton audit: `TokenCipherService`, `DiscordService`, `LastfmService`, `SpotifyService`, `UserService`, `ParserService`, and `ScrobblerService` hold only immutable constructor-injected collaborators; none has per-request mutable state. The auth, user, and scrobble controllers are stateless apart from immutable injected collaborators.
- Converted the integrations and services to Nest providers using `AppConfig` and the shared `DB` token. Converted `/api/auth`, `/api/user`, and `/api/scrobble` to Nest controllers and removed their Express routers from `legacyRoutes.ts`; the deleted route files are no longer needed.
- Migrated auth/user/scrobble contract tests to real Nest HTTP tests with provider overrides. Existing status/body assertions remain intact. The direct legacy contract helper now resets its API-key fixture on every server start, because `botAuth.test.ts` clears the process environment after its own test; this fixed four downstream legacy contract failures without changing a production response.
- The Nest Express adapter emits an empty response for a handler that returns literal `null`. `UserController.exists` uses a JSON-null sentinel so the response remains `200` with body `null`, matching the unchanged golden and existing API contract.
- `bun run dev:test` passed: dev config 2 tests, Activity gateway 5, API 1,758 tests across 191 files, bot 257 across 45 files, and Activity 291 across 73 files. API parity is included and passed against the unchanged golden.
- Workspace checks passed: `pnpm run typecheck`, `pnpm run lint`, and `pnpm run build`. Existing bot and Activity lint warnings remain unchanged.

## Phase 4: Gamification and maze

- Move-only checkpoint `faeef79` moved the gamification, evolutive-achievement, and maze services/controllers into feature modules and rewrote imports only.
- Singleton audit: `GamificationService` holds only the Leveling, Achievement, EvolutiveAchievement, and database providers; the other services hold their injected database or collaborator. No provider has per-request mutable state. All controller dependencies are immutable constructor references.
- Added `GamificationModule` and `MazeModule`, imported them into the app, and injected `GamificationService` into startup. Services now use the `DB` token. The temporary constructor defaults were removed when realtime callers moved to injected room dependencies in Phases 7/8.
- Converted all 12 gamification, 3 evolutive-achievement, and 4 maze routes to Nest controllers with contract inputs, exact custom validation messages, explicit POST statuses, and route error metadata. Removed the three Express router files and their legacy mounts.
- Ported the gamification and maze HTTP contract tests to real Nest modules. Converted the maze controller validation tests to HTTP tests with the same response assertions, and added DI smoke coverage for `AppModule`, `GamificationModule`, and `MazeModule`.
- A first test run exposed that sending JSON `null` through Express's strict JSON parser is rejected before controller validation. The HTTP test now sends `{}` to exercise the same missing-`userId` validation path; no production code or parity golden changed.
- `bun run dev:test` passed: dev config 2 tests, Activity gateway 5, API 1,759 tests across 192 files, bot 257 across 45 files, and Activity 291 across 73 files. The API parity suite passed against the unchanged golden.
- Workspace gates passed: `pnpm run typecheck`, `pnpm run lint`, and `pnpm run build`. Existing bot and Activity lint warnings remain unchanged.

## Phase 5: Wordle

- Moved the Wordle service tree, word banks, and ten controllers into `modules/wordle`; converted all 41 routes to Nest controllers while preserving the existing contracts, response statuses, validation text, bot auth, and Activity throttling.
- Moved mutable word-bank caches into the singleton `WordBankService`. Startup warms the banned-word, Boggle, and validation-word caches before the HTTP or Colyseus listeners can open; the 85,515-word validation bank still fails startup when missing.
- Registered Wordle services and repositories through feature-module providers using `DB` and explicit factory tokens where construction is parameterized. Moved the Wordle contract/controller tests to real Nest HTTP requests and kept parity goldens unchanged.
- Singleton audit: `WordleService` holds injected collaborators; cached word sets live only in `WordBankService`. Neither stores per-request state. The remaining mutable game/session state stays scoped to a Colyseus room.

## Phase 6: AI chat and emoji reactions

- Added the AI chat and emoji-reaction feature modules and migrated their controllers, LLM clients, thread/research services, tool registry, sandbox, rate limits, and quota providers to Nest DI. Moved configuration reads behind `AppConfig`; Dockerode and tool clients are created by injected factories.
- Registered the two parameterized `DailyQuotaService` instances under separate agent/research tokens. `SandboxManager` keeps no in-memory session state; sessions remain database-backed. `AiTraceRecorder` is a single app provider whose shared open-trace set is drained on `flush`; traces opened during an in-flight flush remain for the next flush.
- Kept per-operation `Frontier` and recorded-trace values local. The module-level Hangman word index and card-game registry remain intentionally shared, matching their pre-migration behavior.
- Updated the tool's sandbox repository path and mirror sync script to the migrated layout. Left `prompts.ts` unchanged so its prompt hash stays stable.

## Phase 7: Activity and realtime

- Migrated the ten Activity HTTP routes, including the ws-session and deep-link routes, to `ActivityController`; preserved the Discord membership checks, bot auth, route-specific error behavior, and the shared 20-request rate-limit bucket.
- Added the Nest-to-Colyseus dependency bridge and room factories. `GameServer`, maintenance cleanup, and reconciliation overlap state are app-lifecycle singletons; game sessions, rate limiters, disconnect timers, and mutable room state remain per-room. Removed service constructor defaults after all production callers moved to DI.
- Startup now warms the Boggle word bank alongside the Wordle validation cache. Startup ordering is injectable and tested: migrations, optional SQLite import, gamification and AI defaults, stale-job cleanup, word-bank setup, draft finalization, and maintenance start. Startup failures reject initialization before `GameServer.listen()`.
- Focused Activity/startup/DI/parity checks passed: 36 tests across seven files. The route-discovery test finds 97 Nest routes and checks method, path, guards, and status against the permanent manifest; live HTTP responses match all unchanged goldens.

## Phase 8: remove the legacy API surface

- Deleted the Express route trees, legacy router mounts, old controllers/middleware/config helpers, and temporary migration scripts. Removed unused `dotenv` and `express-rate-limit` dependencies. Kept Express itself because Nest runs on `@nestjs/platform-express`, and kept `cors` for the shared Express HTTP configuration.
- Converted maintenance/backfill scripts to `NestFactory.createApplicationContext(ScriptsModule)` and close the application context after use. Added `reflect-metadata` before application/test bootstrap, updated the Bun debugger configuration, and refreshed API/deployment/local-development/Wordle documentation.
- Added permanent ESLint architecture checks for direct database-client values, Express value imports, environment reads outside config/logging, `forwardRef`, request/transient scope, and ad-hoc service construction. Temporary negative probes raised the expected lint errors and were removed. Type-only database/Express imports remain allowed.
- Structural audit passed: no Express value imports, direct DB-client values, forbidden environment reads, `forwardRef`, request/transient scope, `@Res()`, or service construction outside provider factories; legacy route/controller/middleware/utils roots and `src/index.ts` are gone. `packages/database` is unchanged.
- The permanent route manifest and Express goldens are unchanged from Phase 0. The only diff under `apps/activity`, `apps/bot`, and `packages` versus `main` is the user-authorized D5 teardown line in `apps/activity/devGateway.test.ts`.

## Final verification

- `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`, and the full `pnpm run test` passed. The API suite passed with 1,760 tests across 193 files, up from the 1,750-test Phase 0 safety-net baseline; the bot and Activity suites remain at 257 and 291 tests. `pnpm run test:dev` passed seven tests and its `dev/tsconfig.json` typecheck. Existing bot-test and Activity-UI lint warnings remain; there are no lint errors.
- `pnpm run test:deploy-env` passed when the script ran in the Linux Docker environment. Running it directly on macOS fails at the script's GNU `stat -c` call because the host provides BSD `stat`; no application change was needed.
- The production Docker image built from the repo root and booted against a fresh PostgreSQL 17 Alpine database. The database had 30 Drizzle migrations and six seeded `xp_config` rows; `/api/health` returned `{"status":"ok"}` and Docker marked the container healthy. A missing `MARQUINHOS_API_KEY` exited 1 during config validation. An image variant without `valid-guesses.txt` exited 1 with `ENOENT` during startup before application/listener startup.
- Real `@colyseus/sdk` clients joined `match` with signed ws-session tokens. A Tic-Tac-Toe win wrote one `game_results` row and two `user_game_results` rows. A solved Wordle created a solved session and awarded 150 total XP. These probes used isolated disposable PostgreSQL data and dummy application secrets.
- `pnpm run dev` started the configured API, bot, Activity gateway, PostgreSQL, and tunnel. Using the real `@marquinhos/api-client`, `POST /api/gamification/xp` returned 200 and `POST /api/activities/deep-link` returned 200 with `{ok:true}`. The stack was stopped with `pnpm run dev:down`; its PostgreSQL service was restored afterward.
- The API image's healthcheck passed. `docker stop --timeout 30` returned exit code 0 in about 0.2 seconds. Docker Desktop exposes its socket as group 0; the image could run `docker ps` through the mounted socket when run with supplemental group 0, matching that host socket's group. Deployment Compose passes `DOCKER_GID` so Linux deployments can use their host socket's actual group.

## Benchmark comparison

The post-migration `bun run bench` ran on Bun 1.4.2 in Linux arm64 Docker on the same Darwin arm64 host, with 10 connections and 30 seconds per target. The Nest API ran from the Alpine production image against a fresh PostgreSQL 17 Alpine database after migrations/defaults. No application or benchmark tuning was done.

| Target | Express baseline | NestJS result | Comparison |
| --- | --- | --- | --- |
| Wordle validate | 7,476.1 req/s; p50 1 ms; p99 4 ms; 4.21 MB/s | 5,672.9 req/s; p50 1 ms; p99 5 ms; 3.16 MB/s | 24% fewer req/s; p50 unchanged, p99 +1 ms |
| Wordle guess | 605.8 req/s; p50 13 ms; p99 39 ms; 8.19 MB/s | 327.7 req/s; p50 31 ms; p99 67 ms; 9.32 MB/s | 46% fewer req/s; p50 +18 ms, p99 +28 ms |

- Validate had no non-2xx responses or transport errors. Guess had no 5xx, transport errors, timeouts, or resets; 6,746 responses were 2xx and 3,085 were expected 4xx length mismatches. The Express run recorded 5,803 2xx and 12,370 4xx. Since the benchmark cycles five- and six-letter guesses, the changed response mix indicates the fresh databases selected different daily word lengths; this likely contributes to the guess throughput difference because 2xx guesses take the transactional write path while length mismatches return early. The post-migration daily word was six letters; the Express word length was not captured, so the attribution is an inference.
- Guess writes sessions and participation transactionally and serializes same-guild/day work on a row lock, which remains the principal throughput limit. Validate is the cached word-bank read path. The observed request rate is lower after migration; this was measured and recorded without tuning, as required.
