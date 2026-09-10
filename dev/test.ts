import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const storage = await mkdtemp(resolve(tmpdir(), "marquinhos-tests-"));
let failed = false;
try {
  for (const [cwd, args] of [
    [root, ["test", "./dev"]],
    [root, ["test", "apps/activity/devGateway.test.ts"]],
    [resolve(root, "apps/api"), ["run", "test"]],
    [resolve(root, "apps/bot"), ["run", "test"]],
    [resolve(root, "apps/activity"), ["run", "test"]],
  ] as const) {
    const child = Bun.spawn(["bun", ...args], {
      cwd,
      env: {
        ...process.env,
        NODE_ENV: "test",
        SQLITE_PATH: resolve(storage, "tests.db"),
      },
      stdout: "inherit",
      stderr: "inherit",
    });
    if (await child.exited) failed = true;
  }
} finally {
  await rm(storage, { recursive: true });
}
process.exitCode = failed ? 1 : 0;
