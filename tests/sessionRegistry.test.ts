import { describe, expect, it } from 'bun:test';
import { SessionRegistry } from 'services/activity/shared/SessionRegistry';

describe('SessionRegistry', () => {
  it('creates a session via the factory on first access', () => {
    const registry = new SessionRegistry<{ id: string }>();
    let calls = 0;
    const factory = () => {
      calls += 1;
      return { id: 'a' };
    };

    const first = registry.getOrCreate('key-1', factory);
    expect(first).toEqual({ id: 'a' });
    expect(calls).toBe(1);
  });

  it('reuses the same session for the same key without calling the factory again', () => {
    const registry = new SessionRegistry<{ id: string }>();
    let calls = 0;
    const factory = () => {
      calls += 1;
      return { id: 'a' };
    };

    const first = registry.getOrCreate('key-1', factory);
    const second = registry.getOrCreate('key-1', factory);

    expect(second).toBe(first);
    expect(calls).toBe(1);
  });

  it('keeps different keys isolated from one another', () => {
    const registry = new SessionRegistry<{ id: string }>();

    const a = registry.getOrCreate('key-1', () => ({ id: 'a' }));
    const b = registry.getOrCreate('key-2', () => ({ id: 'b' }));

    expect(a).not.toBe(b);
  });

  it('deletes a session, letting a later getOrCreate rebuild it fresh', () => {
    const registry = new SessionRegistry<{ id: string }>();
    let calls = 0;
    const factory = () => {
      calls += 1;
      return { id: `s${calls}` };
    };

    const first = registry.getOrCreate('key-1', factory);
    registry.delete('key-1');
    const second = registry.getOrCreate('key-1', factory);

    expect(calls).toBe(2);
    expect(second).not.toBe(first);
  });

  it('get returns undefined for a key that was never created', () => {
    const registry = new SessionRegistry<{ id: string }>();
    expect(registry.get('missing')).toBeUndefined();
  });
});
