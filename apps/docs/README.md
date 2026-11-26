# MarquinhosBOT documentation

From the repository root, run `pnpm --filter @marquinhos/docs dev` to generate the references and start the Starlight dev server. Use `pnpm --filter @marquinhos/docs build` for the production build and `pnpm --filter @marquinhos/docs preview` to serve it locally. The build runs `gen:openapi`, `gen:asyncapi`, and `gen:commands` from workspace source, validates the two specs with Redocly, and checks the resulting pages and links.

Contributor guides live in `src/content/docs/contributors`. The generated Discord reference follows the Sapphire registry. The curated TypeScript reference starts at `src/public-api.ts`.

Pagefind indexes the Starlight content. Use Scalar's search inside HTTP API or Activity events to find individual operations and messages. Those entries load in the browser using the version-pinned Scalar script.
