import { describe, expect, it } from 'bun:test';
import { isPathAllowed } from 'services/aiChat/tools/pathValidation';

describe('isPathAllowed', () => {
  it('allows paths under /repo', () => {
    expect(isPathAllowed('/repo/src/index.ts')).toBe(true);
  });

  it('allows paths under /tmp', () => {
    expect(isPathAllowed('/tmp/scratch.txt')).toBe(true);
  });

  it('allows the root paths themselves', () => {
    expect(isPathAllowed('/repo')).toBe(true);
    expect(isPathAllowed('/tmp')).toBe(true);
  });

  it('rejects paths outside /repo and /tmp', () => {
    expect(isPathAllowed('/etc/passwd')).toBe(false);
  });

  it('rejects traversal attempts that escape the allowed roots', () => {
    expect(isPathAllowed('/repo/../etc/passwd')).toBe(false);
    expect(isPathAllowed('/repo/../../etc/passwd')).toBe(false);
  });

  it('rejects relative paths that resolve outside the allowed roots', () => {
    expect(isPathAllowed('../etc/passwd')).toBe(false);
  });
});
