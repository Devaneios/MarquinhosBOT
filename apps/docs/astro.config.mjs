import starlight from '@astrojs/starlight';
import scalarStarlight from '@scalar/starlight';
import mermaid from 'astro-mermaid';
import { defineConfig } from 'astro/config';
import linksValidator from 'starlight-links-validator';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

const scalarCdn =
  'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.84.0/dist/browser/standalone.js';

export default defineConfig({
  integrations: [
    mermaid(),
    starlight({
      title: 'MarquinhosBOT',
      components: { Head: './src/components/Head.astro' },
      sidebar: [
        { label: 'Local development', slug: 'contributors/local-development' },
        {
          label: 'Architecture',
          items: [{ autogenerate: { directory: 'contributors/architecture' } }],
        },
        {
          label: 'Features',
          items: [{ autogenerate: { directory: 'contributors/features' } }],
        },
        {
          label: 'Decisions',
          items: [{ autogenerate: { directory: 'contributors/decisions' } }],
        },
        { label: 'Discord commands', slug: 'reference/commands' },
        typeDocSidebarGroup,
      ],
      plugins: [
        scalarStarlight({
          configuration: { url: '/openapi.json', cdn: scalarCdn },
          pathname: '/api-reference',
          label: 'HTTP API',
        }),
        scalarStarlight({
          configuration: { url: '/asyncapi.json', cdn: scalarCdn },
          pathname: '/event-reference',
          label: 'Activity events',
        }),
        starlightTypeDoc({
          entryPoints: ['src/public-api.ts'],
          tsconfig: 'tsconfig.typedoc.json',
          output: 'reference/typescript',
          sidebar: { label: 'TypeScript API', collapsed: true },
        }),
        linksValidator({ exclude: ['/api-reference/', '/event-reference/'] }),
      ],
    }),
  ],
});
