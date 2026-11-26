# Repository instructions

## Documentation

When a change adds or modifies an HTTP route, WebSocket event, Discord command, or environment variable, update its source contract or metadata and the corresponding feature or setup guide in the same diff.

- Keep HTTP method, path, schemas, status codes, authentication, and validated examples with the declarations in `packages/contracts/src/http/routes`. Check the controller and guards when behavior changes.
- Keep Activity message types and payload schemas in `packages/contracts/src/activity`. Update the relevant adapter and test the message direction from the server's perspective. Record recovery and authorization changes in the contributor guide.
- Update slash command metadata in `apps/bot/src/lib/commandDefinitions.ts` and registration in `apps/bot/src/lib/registerSapphirePieces.ts` when the published set changes.
- Update the owning app's environment schema and example for new or changed settings. Document their purpose and local defaults in the setup or feature guide.
- For changed public TypeScript boundaries, use TSDoc for caller-visible invariants, side effects, auth assumptions, and failures. Preserve the signature as the source of type information.

Run `pnpm --filter @marquinhos/docs build` to regenerate and validate both specs and the command reference, then build Starlight and check links. The build uses local source and requires no database, Redis instance, or Discord token. Generated reference files are build outputs.
