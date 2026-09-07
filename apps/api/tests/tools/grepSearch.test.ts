import { describe, expect, it, mock } from 'bun:test';
import { grepSearchTool } from 'services/aiChat/tools/grepSearch';

describe('grepSearchTool', () => {
  it('greps recursively against the given path', async () => {
    const exec = mock(async () => ({
      stdout: '/repo/src/a.ts:1:match',
      stderr: '',
      exitCode: 0,
    }));
    const result = await grepSearchTool.execute(
      { pattern: 'RateLimitService', path: '/repo/src' },
      { containerId: 'c1', exec },
    );

    expect(exec).toHaveBeenCalledWith('c1', [
      'grep',
      '-rn',
      'RateLimitService',
      '/repo/src',
    ]);
    expect(result).toContain('match');
  });

  it('defaults to /repo when no path is given', async () => {
    const exec = mock(async () => ({
      stdout: 'match',
      stderr: '',
      exitCode: 0,
    }));
    await grepSearchTool.execute(
      { pattern: 'foo' },
      { containerId: 'c1', exec },
    );

    expect(exec).toHaveBeenCalledWith('c1', ['grep', '-rn', 'foo', '/repo']);
  });

  it('treats grep exit code 1 (no matches) as a normal empty result, not an error', async () => {
    const exec = mock(async () => ({ stdout: '', stderr: '', exitCode: 1 }));
    const result = await grepSearchTool.execute(
      { pattern: 'nonexistent' },
      { containerId: 'c1', exec },
    );

    expect(result).toBe('(nenhum resultado encontrado)');
  });

  it('rejects paths outside /repo and /tmp without calling exec', async () => {
    const exec = mock(async () => ({ stdout: '', stderr: '', exitCode: 0 }));
    const result = await grepSearchTool.execute(
      { pattern: 'x', path: '/etc' },
      { containerId: 'c1', exec },
    );

    expect(exec).not.toHaveBeenCalled();
    expect(result).toContain('não é permitido');
  });

  it('truncates very long output to 4000 characters', async () => {
    const exec = mock(async () => ({
      stdout: 'x'.repeat(5000),
      stderr: '',
      exitCode: 0,
    }));
    const result = await grepSearchTool.execute(
      { pattern: 'x' },
      { containerId: 'c1', exec },
    );

    expect(result.length).toBe(4000);
  });
});
