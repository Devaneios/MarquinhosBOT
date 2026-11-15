import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function resolveApiRoot(): string {
  const candidates = [
    resolve(import.meta.dir, '../..'),
    resolve(import.meta.dir, '..'),
    process.cwd(),
    resolve(process.cwd(), 'apps', 'api'),
  ];
  return (
    candidates.find((dir) => existsSync(resolve(dir, 'wordlist.txt'))) ??
    candidates[0]!
  );
}

export const API_ROOT = resolveApiRoot();
