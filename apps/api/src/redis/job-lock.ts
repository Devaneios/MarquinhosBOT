import { logger } from 'common/logging/logger';
import type { RedisService } from 'redis/redis.service';

export interface ExclusiveJobState {
  running: boolean;
}

/**
 * Serializes a recurring background job locally (via `state.running`) and
 * across API replicas (via Redis distributed lock when configured).
 */
export async function runExclusiveJob(
  state: ExclusiveJobState,
  redis: RedisService | undefined,
  lockKey: string,
  lockTtlMs: number,
  failureEvent: string,
  fn: () => Promise<void>,
): Promise<void> {
  if (state.running) return;
  state.running = true;
  try {
    if (redis) {
      await redis.withLock(lockKey, lockTtlMs, fn);
    } else {
      await fn();
    }
  } catch (error) {
    logger.error(failureEvent, { error });
  } finally {
    state.running = false;
  }
}
