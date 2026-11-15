import { describe, expect, it, mock } from 'bun:test';
import type { SpawnExec } from 'modules/ai-chat/sandbox/dockerode-sandbox.client';
import { DockerodeSandboxClient } from 'modules/ai-chat/sandbox/dockerode-sandbox.client';

const TIMEOUT_EXIT_CODE = 124;

function localSpawn(command: string[]): SpawnExec {
  return (_argv, options) => Bun.spawn(command, options);
}

function clientWithSpawn(command: string[]): DockerodeSandboxClient {
  return new DockerodeSandboxClient({} as never, localSpawn(command));
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

describe('DockerodeSandboxClient.createContainer', () => {
  it('enforces least-privilege capabilities and no-new-privileges', async () => {
    const createContainer = mock(async () => ({ id: 'ctr-1' }));
    const client = new DockerodeSandboxClient(
      { createContainer } as never,
      localSpawn(['true']),
    );

    const id = await client.createContainer({
      image: 'marquinhos-sandbox:latest',
      cmd: ['sleep', 'infinity'],
      networkMode: 'none',
      memoryBytes: 512 * 1024 * 1024,
      nanoCpus: 1_000_000_000,
      pidsLimit: 64,
      readonlyRootfs: true,
      tmpfs: { '/tmp': 'rw,noexec,nosuid,nodev,mode=1777,size=67108864' },
      binds: ['/mirror:/repo:ro'],
      labels: { 'marquinhos.sandbox': 'true' },
    });

    expect(id).toBe('ctr-1');
    expect(createContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        HostConfig: expect.objectContaining({
          CapDrop: ['ALL'],
          SecurityOpt: ['no-new-privileges:true'],
          ReadonlyRootfs: true,
          NetworkMode: 'none',
        }),
      }),
    );
  });
});
