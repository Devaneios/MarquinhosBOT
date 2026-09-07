import { describe, expect, it } from 'bun:test';
import { formatArgs, safeStringify } from './DevConsole';

describe('safeStringify', () => {
  it('returns strings as-is', () => {
    expect(safeStringify('hello')).toBe('hello');
  });

  it('stringifies numbers and booleans', () => {
    expect(safeStringify(42)).toBe('42');
    expect(safeStringify(true)).toBe('true');
  });

  it('renders undefined and null explicitly', () => {
    expect(safeStringify(undefined)).toBe('undefined');
    expect(safeStringify(null)).toBe('null');
  });

  it('pretty-prints plain objects', () => {
    expect(safeStringify({ a: 1, b: 2 })).toBe(
      JSON.stringify({ a: 1, b: 2 }, null, 2),
    );
  });

  it('marks circular references instead of throwing', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    expect(() => safeStringify(obj)).not.toThrow();
    expect(safeStringify(obj)).toContain('[Circular]');
  });

  it('renders Error objects using their stack or message', () => {
    const err = new Error('boom');
    expect(safeStringify(err)).toContain('Error: boom');
  });

  it('renders functions as a named placeholder', () => {
    function namedFn() {}
    expect(safeStringify(namedFn)).toBe('[Function: namedFn]');
  });

  it('renders bigints with a trailing n', () => {
    expect(safeStringify(10n)).toBe('10n');
  });
});

describe('formatArgs', () => {
  it('joins formatted arguments with a single space', () => {
    expect(formatArgs(['a', 1, true])).toBe('a 1 true');
  });

  it('pretty-prints object arguments inline with primitives', () => {
    expect(formatArgs(['result:', { b: 2 }])).toBe(
      `result: ${JSON.stringify({ b: 2 }, null, 2)}`,
    );
  });

  it('returns an empty string for no arguments', () => {
    expect(formatArgs([])).toBe('');
  });
});
