import { describe, expect, it, mock } from 'bun:test';
import { executeCodeTool } from 'services/aiChat/tools/executeCode';

describe('executeCodeTool', () => {
  it('runs python code via python3 -c', async () => {
    const exec = mock(async () => ({ stdout: '4', stderr: '', exitCode: 0 }));
    const result = await executeCodeTool.execute(
      { language: 'python', code: 'print(2+2)' },
      { containerId: 'c1', exec },
    );

    expect(exec).toHaveBeenCalledWith('c1', ['python3', '-c', 'print(2+2)']);
    expect(result).toContain('4');
  });

  it('runs javascript code via bun -e', async () => {
    const exec = mock(async () => ({ stdout: '4', stderr: '', exitCode: 0 }));
    await executeCodeTool.execute(
      { language: 'javascript', code: 'console.log(2+2)' },
      { containerId: 'c1', exec },
    );

    expect(exec).toHaveBeenCalledWith('c1', ['bun', '-e', 'console.log(2+2)']);
  });

  it('runs bash code via bash -c', async () => {
    const exec = mock(async () => ({ stdout: 'hi', stderr: '', exitCode: 0 }));
    await executeCodeTool.execute(
      { language: 'bash', code: 'echo hi' },
      { containerId: 'c1', exec },
    );

    expect(exec).toHaveBeenCalledWith('c1', ['bash', '-c', 'echo hi']);
  });

  it('does not validate the code content for a path — arbitrary code is the intended behavior', async () => {
    const exec = mock(async () => ({
      stdout: 'root:x:0:0',
      stderr: '',
      exitCode: 0,
    }));
    const result = await executeCodeTool.execute(
      { language: 'bash', code: 'cat /etc/passwd' },
      { containerId: 'c1', exec },
    );

    expect(exec).toHaveBeenCalledWith('c1', ['bash', '-c', 'cat /etc/passwd']);
    expect(result).toContain('root:x:0:0');
  });

  it('rejects an unsupported language without calling exec', async () => {
    const exec = mock(async () => ({ stdout: '', stderr: '', exitCode: 0 }));
    const result = await executeCodeTool.execute(
      { language: 'ruby', code: 'puts 1' },
      { containerId: 'c1', exec },
    );

    expect(exec).not.toHaveBeenCalled();
    expect(result).toContain('não suportada');
  });

  it('includes stdout, stderr, and exit code in the result', async () => {
    const exec = mock(async () => ({
      stdout: 'out',
      stderr: 'warn',
      exitCode: 1,
    }));
    const result = await executeCodeTool.execute(
      { language: 'bash', code: 'exit 1' },
      { containerId: 'c1', exec },
    );

    expect(result).toContain('out');
    expect(result).toContain('warn');
    expect(result).toContain('exit code: 1');
  });
});

describe('executeCodeTool missing-binary hints', () => {
  function notFound(binary: string) {
    return mock(async () => ({
      stdout: '',
      stderr: `bash: line 1: ${binary}: command not found`,
      exitCode: 127,
    }));
  }

  it.each(['curl', 'wget', 'traceroute', 'ping', 'dig'])(
    'points at fetch_url when the model reaches for %s',
    async (binary) => {
      const result = await executeCodeTool.execute(
        { language: 'bash', code: `${binary} https://pt.wikipedia.org` },
        { containerId: 'c1', exec: notFound(binary) },
      );

      expect(result).toContain('fetch_url');
      expect(result).toContain(binary);
    },
  );

  it('lists what the image actually has for a non-network missing binary', async () => {
    const result = await executeCodeTool.execute(
      { language: 'bash', code: 'jq .' },
      { containerId: 'c1', exec: notFound('jq') },
    );

    expect(result).toContain('jq');
    expect(result).toContain('python3');
    expect(result).toContain('bash');
    expect(result).not.toContain('fetch_url');
  });

  it('still hints on exit 127 when stderr does not name the binary', async () => {
    const exec = mock(async () => ({
      stdout: '',
      stderr: '',
      exitCode: 127,
    }));
    const result = await executeCodeTool.execute(
      { language: 'bash', code: 'algumacoisa' },
      { containerId: 'c1', exec },
    );

    expect(result).toContain('127');
    expect(result).toContain('python3');
  });

  it('does not add a hint when the command succeeds', async () => {
    const exec = mock(async () => ({
      stdout: 'ok',
      stderr: '',
      exitCode: 0,
    }));
    const result = await executeCodeTool.execute(
      { language: 'bash', code: 'echo ok' },
      { containerId: 'c1', exec },
    );

    expect(result).not.toContain('fetch_url');
    expect(result).not.toContain('não existe');
  });
});

describe('executeCodeTool description', () => {
  it('blames the sandbox for the missing network and points to fetch_url', () => {
    expect(executeCodeTool.description).toContain('fetch_url');
    expect(executeCodeTool.description.toLowerCase()).toContain('sandbox');
  });
});
