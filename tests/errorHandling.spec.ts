import { describe, expect, it } from 'bun:test';
import { safeExecute } from '../src/utils/errorHandling';

describe('safeExecute', () => {
  it('returns a function', () => {
    const wrapped = safeExecute(() => {});
    expect(typeof wrapped).toBe('function');
  });

  it('does not rethrow when the wrapped function throws synchronously', () => {
    const wrapped = safeExecute(() => {
      throw new Error('sync boom');
    });
    expect(() => wrapped()).not.toThrow();
  });

  it('does not throw when the wrapped function resolves normally', () => {
    const wrapped = safeExecute(() => Promise.resolve(42));
    expect(() => wrapped()).not.toThrow();
  });

  it('does not throw synchronously when the wrapped function returns a rejected promise', () => {
    const wrapped = safeExecute(() => Promise.reject(new Error('async boom')));
    expect(() => wrapped()).not.toThrow();
  });

  it('the returned wrapper is invoked with no arguments', () => {
    let callArgs: unknown[] | undefined;
    const wrapped = safeExecute((...args: unknown[]) => {
      callArgs = args;
    });
    wrapped();
    expect(callArgs).toEqual([]);
  });
});
