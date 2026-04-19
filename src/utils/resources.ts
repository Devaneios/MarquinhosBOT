import { existsSync } from 'fs';
import { join } from 'path';

export function resourcePath(...segments: string[]): string {
  const roots = [
    process.env.ROOT_DIR ? join(process.env.ROOT_DIR, 'resources') : null,
    join(process.cwd(), 'src', 'resources'),
    join(process.cwd(), 'dist', 'resources'),
    join(process.cwd(), 'resources'),
  ].filter((root): root is string => Boolean(root));

  const root = roots.find((candidate) => existsSync(candidate)) ?? roots[0];
  return join(root, ...segments);
}
