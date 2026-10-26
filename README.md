# Marquinhos

Marquinhos is a Discord bot with games, music, and AI chat. It also has a React
Activity for playing games inside Discord, including Terminhos, its daily word
game. You can start a Terminhos puzzle through the bot and pick it up in the
Activity with the same saved guesses.

Everything lives here: the bot, API, Activity, shared packages, and database code.
The project uses TypeScript, pnpm, Bun, and Turborepo, with Express and Colyseus
on the API side and PostgreSQL for storage.

If you want to run it locally, start below. Discord credentials and the tunnel
need some setup, so there's a separate [local development guide](docs/local-development.md)
for those steps.

## Run it locally

You'll need Node 22, pnpm 11.10.0, Bun 1.4.2, and Docker with Compose 2.24 or
newer. The pnpm version is pinned in [package.json](package.json), and the
[CI workflow](.github/workflows/ci.yml) records the runtime versions.

Bun is needed on the host to run the development CLI behind `pnpm run dev`
and `pnpm run dev:doctor`. The services themselves run inside Docker.

From the repository root, install the dependencies.

```sh
pnpm install --frozen-lockfile
```

Follow [Configure once](docs/local-development.md#configure-once) and
[Tunnel and Discord](docs/local-development.md#tunnel-and-discord) to set up the
development application, environment files, and tunnel. Use a separate Discord
application and a test channel for development.

Once those are ready, start the stack.

```sh
pnpm run dev
```

This builds the development images and starts the bot, API, Activity, PostgreSQL,
and Cloudflare tunnel. Logs appear together in the terminal. The bot and API
restart when their source changes, and Vite updates the Activity as you edit it.

In another terminal, check that everything is ready.

```sh
pnpm run dev:doctor
```

The doctor checks configuration, service health, routing, and the bot's Discord
connection. If something fails, start with the
[troubleshooting guide](docs/local-development.md#troubleshooting).

Ctrl+C stops the running stack. Use `pnpm run dev:down` to remove the development
containers and network while keeping the database. Dependency and word-list
changes need an image rebuild; restarting `pnpm run dev` handles that.

## What's in the repo

The apps share contracts and game rules so the bot and Activity can use the same
API and saved progress.

| Path                                                                                     | What's there                                                                |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [apps/bot](apps/bot/README.md)                                                           | Discord commands, music, scheduled messages, and image rendering            |
| [apps/api](apps/api/README.md)                                                           | HTTP endpoints, game sessions, authentication, AI services, and persistence |
| [apps/activity](apps/activity/README.md)                                                 | The React frontend for Discord Activities                                   |
| [packages/contracts](packages/contracts)                                                 | Shared HTTP and game-message schemas                                        |
| [packages/api-client](packages/api-client)                                               | API clients for the bot and browser                                         |
| [packages/domain](packages/domain)                                                       | Game rules and calculations shared by the apps                              |
| [packages/database](packages/database)                                                   | Database schema, migrations, import code, and test helpers                  |
| [packages/eslint-config](packages/eslint-config), [packages/tsconfig](packages/tsconfig) | Shared lint and TypeScript settings                                         |
| [dev](dev)                                                                               | Local Docker stack and development commands                                 |
| [deploy](deploy)                                                                         | Release images, gateway, and deployment scripts                             |
| [docs](docs)                                                                             | Longer guides and feature documentation                                     |

HTTP endpoints and game messages are defined in `@marquinhos/contracts`.
The clients derive their types from those schemas. [CONTEXT.md](CONTEXT.md)
explains the names used for rooms, sessions, and adapters.

## Useful commands

Run these from the repository root.

| What you want to do                    | Command                 |
| -------------------------------------- | ----------------------- |
| Start development                      | `pnpm run dev`          |
| Check the local setup                  | `pnpm run dev:doctor`   |
| Stop and remove development containers | `pnpm run dev:down`     |
| Register development slash commands    | `pnpm run dev:register` |
| Run app and gateway tests in Docker    | `pnpm run dev:test`     |
| Check types                            | `pnpm run typecheck`    |
| Run linters                            | `pnpm run lint`         |
| Run workspace tests                    | `pnpm run test`         |
| Build the apps                         | `pnpm run build`        |

`dev:test` uses dummy credentials and disposable test databases, so you don't
need a Discord login or a working tunnel to run it. Running workspace tests on
the host needs PostgreSQL and some native bot dependencies. See
[Run workspace checks](docs/local-development.md#run-workspace-checks) for that
setup and the full CI command list.

For a smaller change, you can run one package's script. For example:

```sh
pnpm --filter @marquinhos/domain test
```

The development guide also covers
[changed-package filters and caching](docs/local-development.md#run-checks-for-selected-packages).

## Making changes

Before pushing changes, run typecheck, lint, and the tests relevant to what
you changed. For a bug fix, include how to reproduce the problem. If you change
a command or setup step, update its documentation too.

Git hooks format and lint staged source files. Commit messages use
[Conventional Commits](commitlint.config.mjs), for example
`fix(wordle): handle repeated guesses`. Use pnpm for dependency changes and
commit the updated lockfile with the package manifest.

## Deployment

Pushes to `develop` deploy to the development environment. Production releases
use `v*` tags on commits from `main`, such as `v1.2.3`. A push to `main` runs CI.

The [deployment guide](docs/deployment.md) covers the rest: environment setup,
release steps, backups, database migrations, and rollback.

## More documentation

These guides go into the parts that don't fit on the front page.

- [Local development](docs/local-development.md): Discord setup, Docker, tests, and troubleshooting.
- [API](apps/api/README.md) and [Activity](apps/activity/README.md): how the apps are organized.
- [Data model](docs/data-model.md): tables, relationships, and migration compatibility.
- [Daily Wordle](docs/wordle.md): how Terminhos works across the bot, API, and Activity.
- [Operate daily Wordle](docs/wordle-operations.md): channel setup, word lists, and achievement backfills.

## License

See [LICENSE](LICENSE).
