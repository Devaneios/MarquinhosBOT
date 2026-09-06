# Marquinhos Web API

![Bun](https://img.shields.io/badge/bun-1.3-black?logo=bun)
![TypeScript](https://img.shields.io/badge/typescript-5.1-blue?logo=typescript)
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
- SQLite (bundled via `bun:sqlite`, no external install required)
- Docker (optional, for containerized runs)

## Local Setup & Installation

```bash
git clone git@github.com:Devaneios/marquinhos-web-api.git
cd marquinhos-web-api

bun install

cp .env.example .env  # if present, otherwise create manually — see below
```

Required environment variables (`.env`):

| Variable | Purpose |
|---|---|
| `HTTP_PORT` | Port the HTTP server listens on |
| `HTTPS_PORT` | Port for HTTPS (if configured) |
| `NODE_ENV` | `development` / `production` |
| `SQLITE_PATH` | Path to the SQLite database file |
| `MARQUINHOS_API_KEY` | Shared secret for bot-to-API requests (`Authorization: Bearer`) |
| `MARQUINHOS_SECRET_KEY` | Key used to encrypt/decrypt Discord session tokens |
| `DISCORD_BOT_TOKEN` | Bot token, used for Discord API calls |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_REDIRECT_URI` | Discord OAuth config |
| `LASTFM_API_KEY` / `LASTFM_SHARED_SECRET` / `LASTFM_REDIRECT_URI` | Last.fm scrobbling OAuth |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Spotify metadata lookups |
| `CORS_ORIGINS` | Comma-separated allowlist (defaults to `localhost:4200` + prod web app) |
| `KNOWLEDGE_BASE_URL` | Base URL of the local devaneios-chats RAG service (e.g. `http://devaneios-rag:8420`), used by the bot to look up server lore/history. Optional — omit to run without it. |
| `KNOWLEDGE_BASE_API_KEY` | Bearer token sent to `KNOWLEDGE_BASE_URL`. Must match that service's `RAG_API_KEY`. |
| `OPENAI_API_KEY` | OpenAI credentials for every AI feature |
| `OPENAI_MODEL` | Model id (defaults to `gpt-5.4-mini`) |
| `OPENAI_REASONING_EFFORT` | Reasoning effort for thread calls (defaults to `medium`); the research pipeline sets its own per phase |
| `SEARXNG_URL` | SearXNG instance used by `search_web` and deep research (defaults to `https://searxng.frois.net.br`) |
| `AI_THREAD_TOKEN_BUDGET` | Transcript size that triggers thread compaction (defaults to `120000`) |
| `AI_THREAD_RETENTION_DAYS` | How long an idle thread transcript is kept (defaults to `30`) |
| `AI_RESEARCH_MAX_ROUNDS` | Search rounds per research job (defaults to `5`) |
| `AI_RESEARCH_MAX_SEARCHES` | Total searches per research job (defaults to `30`) |
| `AI_RESEARCH_MAX_FETCHES` | Total pages read per research job (defaults to `40`) |
| `AI_RESEARCH_DEADLINE_MS` | Wall-clock deadline per research job (defaults to `900000`; the last 3 min are reserved for analysis and writing) |
| `AI_RESEARCH_RETENTION_DAYS` | How long research jobs and their events are kept (defaults to `14`) |

Run the database migrations and start the dev server:

```bash
bun run dev
```

`src/index.ts` runs `runMigrations()` and initializes gamification defaults on boot — a failure here crashes the process intentionally rather than serving with a broken config.

### Docker

```bash
docker compose up --build
```

The Dockerfile is a two-stage build: dependencies and the Wordle valid-guesses word list are compiled in a `builder` stage, then only `node_modules`, `src/`, and the generated word lists are copied into the `oven/bun:1-alpine` runtime image.

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

Web-authenticated request (from the Angular frontend, Discord token instead of the API key):

```bash
curl http://localhost:3000/api/gamification/level/123/456 \
  -H "Authorization: Bearer <discord-access-token>" \
  -H "marquinhos-agent: web"
```

### Route map

| Mount | Router | Notes |
|---|---|---|
| `/api/auth` | `auth.route.ts` | Discord OAuth login/callback |
| `/api/user` | `user.route.ts` | User profile/settings |
| `/api/scrobble` | `scrobble.route.ts` | Last.fm scrobble ingestion |
| `/api/privacy-policy` | `privacyPolicy.route.ts` | Static policy content |
| `/api/gamification` | `gamification.route.ts` | XP, levels, leaderboard, game results |
| `/api/evolutive-achievements` | `evolutiveAchievements.route.ts` | Tiered achievement progression |
| `/api/games/maze` | `maze.route.ts` | Maze minigame sessions |
| `/api/wordle` | `wordle.route.ts` | Wordle guesses and word list review |
| `/api/ai-chat` | `aiChat.route.ts` | Tag replies, `/ia` threads, deep research jobs, traces |

### AI endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/ai-chat/respond` | The `@Marquinhos` tag flow: classify, answer in persona, revise |
| `POST` | `/api/ai-chat/thread/ask` | One turn of an `/ia perguntar` thread — skips classification, keeps the transcript |
| `POST` | `/api/ai-chat/research` | Starts a deep research job; returns `202` with a `jobId` |
| `GET` | `/api/ai-chat/research/:jobId` | Job status, progress events, and the finished report |
| `GET` | `/api/ai-chat/traces` | Recent AI traces |
| `GET` | `/api/ai-chat/traces/:traceId` | One trace with every LLM call, tool call and exec |

## Architecture / How it Works

- **Runtime**: Express app on Bun, entry point `src/index.ts`.
- **Auth**: two paths through the same middleware chain (`middlewares/botAuth.ts`):
  - Requests with header `marquinhos-agent: web` are routed to `verifyDiscordToken` (`middlewares/userAuth.ts`), which decrypts the token, checks expiry, and fetches the user's Discord identity + guild role.
  - All other requests are checked against `MARQUINHOS_API_KEY` using a timing-safe buffer comparison.
- **Persistence**: `bun:sqlite`, single file DB at `SQLITE_PATH`. Schema is created idempotently in `database/sqlite.ts` (`CREATE TABLE IF NOT EXISTS`), with incremental changes applied via numbered SQL files in `database/migrations/` and run through `database/migrate.ts` at boot.
- **Gamification**: `services/gamification.ts` handles XP awards, level-up detection, and cooldowns; `services/evolutiveAchievements.ts` tracks per-user stat counters and auto-evolves tiered achievements when thresholds are crossed. Both are wired into the same `addXP` call path.
- **Wordle**: valid-guess word list is pre-generated at Docker build time (`scripts/build-valid-guesses.ts`) from `wordlist.txt` + an external word frequency list, then loaded into memory once on boot (`getValidationSet()`) to avoid disk I/O per request.
- **AI features**: three separate paths share one set of tools and one trace recorder.
  - *Tag flow* (`AiChatService`): two-layer intent classification, persona response per category, then a revision pass. Runs on Chat Completions. Unchanged by the `/ia` work.
  - *Threads* (`thread/AiThreadService`): one turn of an `/ia perguntar` conversation. No classification — it goes straight to an agentic loop with the full tool set. Runs on the **Responses API** so the model's own `reasoning` items (with `encrypted_content`) can be stored and replayed on later turns; `reasoning.context: 'all_turns'` is what carries the reasoning forward. Reasoning is never posted to Discord, only kept in context and in the trace. Transcripts live in `ai_thread_items` as raw API items, and are compacted into a summary once they pass `AI_THREAD_TOKEN_BUDGET`.
  - *Deep research* (`research/DeepResearchService`): a frontier search with a reflection loop — plan facets and 8-16 sub-queries, search SearXNG in parallel, rank and dedupe hits, let an LLM triage step pick which results are worth reading, compress each page to the claims it serves plus the follow-up queries it opens, push those follow-ups back onto the frontier (up to 3 levels deep), and keep going until an evidence floor is met (2 rounds, 12 relevant sources, 2 sources per facet) — the reflection step can say what to chase next but cannot end the job early. Then a dedicated analysis pass cross-reads every source before the report is written. The per-source compression is what keeps the synthesis call inside the context window. Jobs run detached in-process (`research/ResearchOrchestrator`) because a pass takes minutes; the bot polls. `POST /research` is idempotent on `idempotencyKey` since the bot's HTTP client retries.
- **Agent tools** (`services/aiChat/tools/`): `list_directory`, `grep_search`, `read_file` and `execute_code` run inside a Docker sandbox on `NetworkMode: none`; `search_web` and `fetch_url` run in the API process instead, which is what keeps arbitrary model-written code off the network. `web/fetchPage.ts` holds the SSRF screening, body cap and HTML→markdown conversion shared by `fetch_url` and the research reader.
- **Rate limiting**: `express-rate-limit` is wired into `index.ts` but currently commented out — re-enable before exposing sensitive endpoints publicly. AI usage has its own daily limits in `ai_chat_config`: `user_daily_limit`, `global_daily_limit`, `agent_daily_limit`, and `research_daily_limit` (much lower — one research job spends dozens of LLM calls).
- **Error handling**: a 404 catch-all and a 4-arg Express error handler sit at the bottom of the middleware stack; error details are only returned in the response body outside of `production`.

## Contributing

```bash
bun run typecheck     # tsc --noEmit
bun run lint          # eslint src/**/*.ts
bun run format:check  # prettier --check
bun test tests/**/*.spec.ts
```

- Husky + `lint-staged` run `prettier --write` and `eslint --fix` on staged `*.ts` files pre-commit.
- Commit messages are linted with `commitlint` against the conventional-commits config — use `type(scope): message` (`feat:`, `fix:`, `chore:`, etc.).
- Match existing patterns: controllers stay thin and delegate to `services/`, routes bind controller methods with `.bind(controller)`, and Zod schemas in `schemas/` validate request bodies via `validateRequest.ts`.
- Open a PR against `main`; CI must pass typecheck, lint, and tests before merge.

## License

ISC
