import { describe, expect, it } from 'bun:test';
import { RateLimiter } from 'services/activity/shared/RateLimiter';

describe('RateLimiter', () => {
  it('allows requests up to max within a window', () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 3 });
    const key = {};

    expect(limiter.isOverLimit(key)).toBe(false);
    expect(limiter.isOverLimit(key)).toBe(false);
    expect(limiter.isOverLimit(key)).toBe(false);
    expect(limiter.isOverLimit(key)).toBe(true);
  });

  it('resets the count once the window rolls over', async () => {
    const limiter = new RateLimiter({ windowMs: 20, max: 1 });
    const key = {};

    expect(limiter.isOverLimit(key)).toBe(false);
    expect(limiter.isOverLimit(key)).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(limiter.isOverLimit(key)).toBe(false);
  });

  it('tracks separate keys independently', () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 1 });
    const keyA = {};
    const keyB = {};

    expect(limiter.isOverLimit(keyA)).toBe(false);
    expect(limiter.isOverLimit(keyA)).toBe(true);
    expect(limiter.isOverLimit(keyB)).toBe(false);
  });

  it('forgets a key once cleared', () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 1 });
    const key = {};

    expect(limiter.isOverLimit(key)).toBe(false);
    limiter.clear(key);
    expect(limiter.isOverLimit(key)).toBe(false);
  });
});
