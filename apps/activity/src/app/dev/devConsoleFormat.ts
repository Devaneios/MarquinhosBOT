export function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'function')
    return `[Function: ${value.name || 'anonymous'}]`;
  if (value instanceof Error)
    return value.stack ?? `${value.name}: ${value.message}`;

  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === 'function') {
          return `[Function: ${val.name || 'anonymous'}]`;
        }
        if (typeof val === 'bigint') return `${val}n`;
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
        }
        return val;
      },
      2,
    );
  } catch {
    return String(value);
  }
}

export function formatArgs(args: unknown[]): string {
  return args.map(safeStringify).join(' ');
}
