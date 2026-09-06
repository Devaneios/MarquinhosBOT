export interface RateLimiterOptions {
  windowMs: number;
  max: number;
}

// Fixed-window counter keyed by an arbitrary object (typically a WebSocket),
// extracted from PongActivityManager's original per-connection input-rate
// closure so every game can rate-limit its message handlers without
// re-implementing the window/count bookkeeping.
export class RateLimiter {
  private state = new Map<object, { windowStart: number; count: number }>();

  constructor(private options: RateLimiterOptions) {}

  isOverLimit(key: object): boolean {
    const now = Date.now();
    const entry = this.state.get(key);
    if (!entry || now - entry.windowStart >= this.options.windowMs) {
      this.state.set(key, { windowStart: now, count: 1 });
      return false;
    }
    entry.count += 1;
    return entry.count > this.options.max;
  }

  clear(key: object): void {
    this.state.delete(key);
  }
}
