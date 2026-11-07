# NestJS migration log

## Phase 0: baseline and safety net

**Status: Phase 0 and Phase 1 complete; beginning Phase 2.**

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
