import { describe, expect, it, mock } from 'bun:test';
import { listDirectoryTool } from 'services/aiChat/tools/listDirectory';

describe('listDirectoryTool', () => {
  it('lists files by execing ls -la against the given path', async () => {
    const exec = mock(async () => ({
      stdout: 'file1.ts\nfile2.ts',
      stderr: '',
      exitCode: 0,
    }));
    const result = await listDirectoryTool.execute(
      { path: '/repo/src' },
      { containerId: 'c1', exec },
    );

    expect(exec).toHaveBeenCalledWith('c1', ['ls', '-la', '/repo/src']);
    expect(result).toBe('file1.ts\nfile2.ts');
  });

  it('rejects paths outside /repo and /tmp without calling exec', async () => {
    const exec = mock(async () => ({ stdout: '', stderr: '', exitCode: 0 }));
    const result = await listDirectoryTool.execute(
      { path: '/etc' },
      { containerId: 'c1', exec },
    );

    expect(exec).not.toHaveBeenCalled();
    expect(result).toContain('não é permitido');
  });

  it('returns a truncated error message when the command fails', async () => {
    const exec = mock(async () => ({
      stdout: '',
      stderr: 'no such file or directory',
      exitCode: 1,
    }));
    const result = await listDirectoryTool.execute(
      { path: '/repo/nope' },
      { containerId: 'c1', exec },
    );

    expect(result).toContain('no such file or directory');
  });
});
