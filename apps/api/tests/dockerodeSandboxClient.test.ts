import { describe, expect, it } from 'bun:test';
import type { SpawnExec } from 'services/aiChat/sandbox/DockerodeSandboxClient';
import { DockerodeSandboxClient } from 'services/aiChat/sandbox/DockerodeSandboxClient';

const TIMEOUT_EXIT_CODE = 124;

function localSpawn(command: string[]): SpawnExec {
  return (_argv, options) => Bun.spawn(command, options);
}

function clientWithSpawn(command: string[]): DockerodeSandboxClient {
  return new DockerodeSandboxClient(undefined, localSpawn(command));
}

describe('DockerodeSandboxClient.exec', () => {
  it('reports a clean exit as success, not as a timeout', async () => {
    const client = clientWithSpawn(['sh', '-c', 'echo hi']);

    const result = await client.exec('container-id', ['ignored'], 8000);

    expect(result.stdout.trim()).toBe('hi');
    expect(result.stderr).not.toContain('timeout');
    expect(result.exitCode).toBe(0);
  });

  it('preserves a non-zero exit code from the executed command', async () => {
    const client = clientWithSpawn(['sh', '-c', 'echo boom >&2; exit 3']);

    const result = await client.exec('container-id', ['ignored'], 8000);

    expect(result.stderr).toContain('boom');
    expect(result.stderr).not.toContain('timeout');
    expect(result.exitCode).toBe(3);
  });

  it('reports a timeout when the command outlives the deadline', async () => {
    const client = clientWithSpawn(['sleep', '10']);

    const result = await client.exec('container-id', ['ignored'], 150);

    expect(result.stderr).toContain('[timeout after 150ms]');
    expect(result.exitCode).toBe(TIMEOUT_EXIT_CODE);
  });
});
