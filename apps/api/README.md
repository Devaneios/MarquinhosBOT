# Marquinhos Web API

![Bun](https://img.shields.io/badge/bun-1.4-black?logo=bun)
![TypeScript](https://img.shields.io/badge/typescript-6.0-blue?logo=typescript)
![License](https://img.shields.io/badge/license-ISC-lightgrey)

REST API backend for the Marquinhos Discord bot ecosystem. Serves gamification (XP, levels, achievements), Wordle, maze minigame, Last.fm scrobbling, and Discord OAuth for the companion bot and web app.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Setup & Installation](#local-setup--installation)
- [Usage](#usage)
- [Architecture / How it Works](#architecture--how-it-works)
- [Contributing](#contributing)
- [License](#license)

## Prerequisites

- [Bun](https://bun.sh) 1.3.x — runtime, package manager, and test runner
- Node.js 22.x (only needed for editor tooling / type-checking with `tsc`)
- PostgreSQL 17 (the development stack runs it in Docker; tests need `TEST_DATABASE_URL` pointing at a server whose user may create databases)
- Docker (optional, for containerized runs)

## Local Setup & Installation

Use the monorepo [local development guide](../../docs/local-development.md).
From the repository root, `bun run dev` starts the API, bot, Activity gateway,
and tunnel in development containers. The API watches source changes, runs
migrations at startup, and stores data in a development-only PostgreSQL container.

`bun run dev:test` runs tests with disposable storage and dummy credentials.
`bun run dev:doctor` checks configuration and service readiness.

Configure API credentials in `apps/api/.env` using `.env.example` as a reference.
Optional integrations such as Last.fm, Spotify, and the knowledge-base service
require their own credentials and reachable URLs. Docker Compose overrides the
API port to 3000 and `DATABASE_URL` to its PostgreSQL service.

## Usage

Health check:

```bash
curl http://localhost:3000/api/health
# { "status": "ok" }
```

Bot-authenticated request (server-to-server):

```bash
curl -X POST http://localhost:3000/api/gamification/xp \
  -H "Authorization: Bearer $MARQUINHOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "123", "guildId": "456", "eventType": "command"}'
```

### Route map

| Mount                         | Nest module/controller                              | Notes                                         |
| ----------------------------- | --------------------------------------------------- | --------------------------------------------- |
| `/api/health`                 | `modules/health/health.controller.ts`              | Container and gateway health check           |
| `/api/privacy-policy`         | `modules/privacy-policy/`                           | Static policy content                         |
| `/api/auth`                   | `modules/auth/auth.controller.ts`                   | Discord OAuth login/callback                  |
| `/api/user`                   | `modules/user/user.controller.ts`                  | User profile/settings                         |
| `/api/scrobble`               | `modules/scrobble/scrobble.controller.ts`          | Last.fm scrobble ingestion                    |
| `/api/gamification`           | `modules/gamification/gamification.controller.ts`  | XP, levels, leaderboard, game results         |
| `/api/evolutive-achievements` | `modules/gamification/`                             | Tiered achievement progression               |
| `/api/games/maze`             | `modules/maze/maze.controller.ts`                  | Maze minigame sessions                        |
| `/api/wordle`                 | `modules/wordle/controllers/`                       | Wordle guesses and word list review           |
| `/api/ai-chat`                | `modules/ai-chat/ai-chat.controller.ts`            | Threads, research jobs, and traces            |
| `/api/emoji-reaction`         | `modules/emoji-reaction/`                            | Emoji choice                                  |
| `/api/activities`             | `modules/activity/activity.controller.ts`           | Discord Activity and Colyseus session helpers |

### AI endpoints

| Method | Path                           | Purpose                                                                            |
| ------ | ------------------------------ | ---------------------------------------------------------------------------------- |
| `POST` | `/api/ai-chat/respond`         | The `@Marquinhos` tag flow: classify, answer in persona, revise                    |
| `POST` | `/api/ai-chat/thread/ask`      | One turn of an `/ia perguntar` thread — skips classification, keeps the transcript |
| `POST` | `/api/ai-chat/research`        | Starts a deep research job; returns `202` with a `jobId`                           |
| `GET`  | `/api/ai-chat/research/:jobId` | Job status, progress events, and the finished report                               |
| `GET`  | `/api/ai-chat/traces`          | Recent AI traces                                                                   |
| `GET`  | `/api/ai-chat/traces/:traceId` | One trace with every LLM call, tool call and exec                                  |

## Architecture / How it Works

- **Runtime**: NestJS 12 on Bun, using `@nestjs/platform-express`; `src/main.ts` boots HTTP and Colyseus on one listener.
- **Auth**: `BotAuthGuard`, `DiscordUserAuthGuard`, and `ActivityAuthGuard` preserve the bot, web-user, and Activity token checks. Bot keys use a timing-safe buffer comparison.
- **Persistence**: PostgreSQL through Drizzle (`postgres.js` driver) at `DATABASE_URL`. The schema lives in `packages/database/src/schema/`; `pnpm --filter @marquinhos/database db:generate` turns schema changes into SQL migrations under `packages/database/drizzle/`, which `runMigrations()` applies at boot. Periodic cleanups (scrobble queue TTL, AI trace/research/thread retention) run from `packages/database/src/maintenance.ts`. Tests get throwaway databases from `@marquinhos/database/testing`.
- **Gamification**: `modules/gamification/` handles XP awards, level-up detection, cooldowns, and tiered achievement progression through injected providers.
- **Wordle**: `modules/wordle/` shares daily answers and player sessions between the bot and Activity. The image build generates `valid-guesses.txt` from `wordlist.txt`, `devaneios-wordlist.txt`, and their plural forms. Startup loads the validation bank into memory. See the [daily Wordle implementation reference](../../docs/wordle.md) and [operations guide](../../docs/wordle-operations.md).
- **AI features**: three separate paths share one set of tools and one trace recorder.
  - _Tag flow_ (`AiChatService`): two-layer intent classification, persona response per category, then a revision pass. Runs on Chat Completions. Unchanged by the `/ia` work.
  - _Threads_ (`thread/AiThreadService`): one turn of an `/ia perguntar` conversation. No classification — it goes straight to an agentic loop with the full tool set. Runs on the **Responses API** so the model's own `reasoning` items (with `encrypted_content`) can be stored and replayed on later turns; `reasoning.context: 'all_turns'` is what carries the reasoning forward. Reasoning is never posted to Discord, only kept in context and in the trace. Transcripts live in `ai_thread_items` as raw API items, and are compacted into a summary once they pass `AI_THREAD_TOKEN_BUDGET`.
  - _Deep research_ (`research/DeepResearchService`): a frontier search with a reflection loop — plan facets and 8-16 sub-queries, search SearXNG in parallel, rank and dedupe hits, let an LLM triage step pick which results are worth reading, compress each page to the claims it serves plus the follow-up queries it opens, push those follow-ups back onto the frontier (up to 3 levels deep), and keep going until an evidence floor is met (2 rounds, 12 relevant sources, 2 sources per facet) — the reflection step can say what to chase next but cannot end the job early. Then a dedicated analysis pass cross-reads every source before the report is written. The per-source compression is what keeps the synthesis call inside the context window. Jobs run detached in-process (`research/ResearchOrchestrator`) because a pass takes minutes; the bot polls. `POST /research` is idempotent on `idempotencyKey` since the bot's HTTP client retries.
- **Agent tools** (`modules/ai-chat/tools/`): `list_directory`, `grep_search`, `read_file` and `execute_code` run inside a Docker sandbox on `NetworkMode: none`; `search_web` and `fetch_url` run in the API process instead, keeping arbitrary model-written code off the network. `modules/ai-chat/web/fetch-page.ts` holds the SSRF screening, body cap and HTML-to-markdown conversion.
- **Rate limiting**: Activity endpoints share a 20-request-per-minute IP bucket. AI usage has daily limits in `ai_chat_config` for users, agents, and research.
- **Error handling**: Nest guards, the route-error interceptor, and the global API exception filter preserve the API response bodies. Morgan keeps request logging for matched and unmatched routes.

## Contributing

```bash
pnpm --filter marquinhos-web-api typecheck
pnpm --filter marquinhos-web-api lint
pnpm --filter marquinhos-web-api test
```

- Husky + `lint-staged` run `prettier --write` and `eslint --fix` on staged `*.ts` files pre-commit.
- Commit messages are linted with `commitlint` against the conventional-commits config — use `type(scope): message` (`feat:`, `fix:`, `chore:`, etc.).
- Keep controllers thin and resolve I/O-bound services through Nest modules. The shared `@marquinhos/contracts` package remains the HTTP source of truth; use `ContractInput` for request validation.
- Open a PR against `main`; CI must pass typecheck, lint, and tests before merge.

## License

ISC
