# NestJS migration log

## Phase 0: baseline and safety net

**Status: Phase 0 through Phase 3 complete; beginning Phase 4.**

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
