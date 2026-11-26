import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

export async function writeValidatedSpec(
  format: 'openapi' | 'asyncapi',
  spec: object,
  output = `${format}.json`,
) {
  const contents = `${JSON.stringify(spec, null, 2)}\n`;
  const temporaryDirectory = await mkdtemp(
    resolve(tmpdir(), `marquinhos-${format}-`),
  );
  const candidate = resolve(temporaryDirectory, `${format}.json`);

  try {
    await writeFile(candidate, contents);
    const result = Bun.spawnSync(
      [
        resolve(import.meta.dir, '../../../../node_modules/.bin/redocly'),
        'lint',
        '--config',
        resolve(import.meta.dir, `${format}.redocly.yaml`),
        candidate,
      ],
      {
        env: { ...process.env, REDOCLY_TELEMETRY: 'off' },
        stdout: 'inherit',
        stderr: 'inherit',
      },
    );
    if (!result.success) throw new Error(`${format} lint failed`);
    const destination = resolve(output);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, contents);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
