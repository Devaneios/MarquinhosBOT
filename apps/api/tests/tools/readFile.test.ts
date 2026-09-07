import { describe, expect, it, mock } from 'bun:test';
import { readFileTool } from 'services/aiChat/tools/readFile';

describe('readFileTool', () => {
  it('reads a file by execing head -c against the given path', async () => {
    const exec = mock(async () => ({
      stdout: 'file contents',
      stderr: '',
      exitCode: 0,
    }));
    const result = await readFileTool.execute(
      { path: '/repo/README.md' },
      { containerId: 'c1', exec },
    );

    expect(exec).toHaveBeenCalledWith('c1', [
      'head',
      '-c',
      '20000',
      '/repo/README.md',
    ]);
    expect(result).toBe('file contents');
  });

  it('rejects paths outside /repo and /tmp without calling exec', async () => {
    const exec = mock(async () => ({ stdout: '', stderr: '', exitCode: 0 }));
    const result = await readFileTool.execute(
      { path: '/etc/passwd' },
      { containerId: 'c1', exec },
    );

    expect(exec).not.toHaveBeenCalled();
    expect(result).toContain('não é permitido');
  });

  it('returns an error message when the file cannot be read', async () => {
    const exec = mock(async () => ({
      stdout: '',
      stderr: 'no such file',
      exitCode: 1,
    }));
    const result = await readFileTool.execute(
      { path: '/repo/missing.txt' },
      { containerId: 'c1', exec },
    );

    expect(result).toContain('no such file');
  });
});
