import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
let failed = false;
for (const [cwd, args] of [
  [root, ['test', './dev']],
  [root, ['test', 'apps/activity/devGateway.test.ts']],
  [resolve(root, 'apps/api'), ['run', 'test']],
  [resolve(root, 'apps/bot'), ['run', 'test']],
  [resolve(root, 'apps/activity'), ['run', 'test']],
] as const) {
  // Database suites create their own throwaway databases on TEST_DATABASE_URL.
  const child = Bun.spawn(['bun', ...args], {
    cwd,
    env: { ...process.env, NODE_ENV: 'test' },
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (await child.exited) failed = true;
}
process.exitCode = failed ? 1 : 0;
