import { readFile } from 'node:fs/promises';

for (const [route, spec] of [
  ['api-reference', 'openapi.json'],
  ['event-reference', 'asyncapi.json'],
]) {
  const html = await readFile(
    new URL(`../dist/${route}/index.html`, import.meta.url),
    'utf8',
  );
  if (!html.includes('data-scalar-client') || !html.includes(`/${spec}`)) {
    throw new Error(`/${route}/ does not mount Scalar with /${spec}`);
  }

  const payload = await readFile(new URL(`../dist/${spec}`, import.meta.url));
  const source = await readFile(new URL(`../public/${spec}`, import.meta.url));
  if (!payload.equals(source)) {
    throw new Error(`The built /${spec} differs from the validated source`);
  }
}
