import { resolve } from 'node:path';

const ALLOWED_ROOTS = ['/repo', '/tmp'];

export function isPathAllowed(path: string): boolean {
  const resolved = resolve('/', path);
  return ALLOWED_ROOTS.some(
    (root) => resolved === root || resolved.startsWith(`${root}/`),
  );
}
