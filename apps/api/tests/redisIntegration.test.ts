import { describe, expect, it } from 'bun:test';
import { RedisThrottlerStorage } from 'redis/redis-throttler.storage';
import { RedisService } from 'redis/redis.service';
import { createTestAppConfig } from './helpers/testAppConfig';

describe('RedisService and RedisThrottlerStorage', () => {
  it('supports local fallback locks, cache, and throttling when REDIS_URL is unset', async () => {
    const redis = new RedisService(createTestAppConfig({ REDIS_URL: '' }));
    expect(redis.isConfigured).toBe(false);

    await expect(redis.ping()).resolves.toBeUndefined();
    expect(await redis.getCached('missing')).toBeNull();
    await redis.setCached('k1', 'v1', 5_000);
    expect(await redis.getCached('k1')).toBe('v1');

    const lockA = await redis.tryAcquireLock('lock:local', 5_000);
    expect(lockA).toBeTruthy();
    expect(await redis.tryAcquireLock('lock:local', 5_000)).toBeNull();
    await redis.releaseLock('lock:local', lockA!);
    expect(await redis.tryAcquireLock('lock:local', 5_000)).toBeTruthy();

    const storage = new RedisThrottlerStorage(redis);
    const first = await storage.increment('k-local', 60_000, 1, 0, 'api');
    const second = await storage.increment('k-local', 60_000, 1, 0, 'api');
    expect(first.totalHits).toBe(1);
    expect(first.isBlocked).toBe(false);
    expect(second.totalHits).toBe(2);
    expect(second.isBlocked).toBe(true);
    expect(second.timeToExpire).toBeGreaterThan(0);
    expect(second.timeToBlockExpire).toBeGreaterThan(0);
    storage.onApplicationShutdown();
  });

  it('keeps a Redis lock alive while a long job runs', async () => {
    const redis = new RedisService(
      createTestAppConfig({ REDIS_URL: 'redis://test' }),
    );
    let token: string | null = null;
    let expiresAt = 0;
    const client = {
      async set(_key: string, value: string, _px: string, ttl: number) {
        if (token && Date.now() < expiresAt) return null;
        token = value;
        expiresAt = Date.now() + ttl;
        return 'OK';
      },
      async eval(
        script: string,
        _keys: number,
        _key: string,
        value: string,
        ttl?: number,
      ) {
        if (token !== value || Date.now() >= expiresAt) return 0;
        if (script.includes('pexpire')) expiresAt = Date.now() + ttl!;
        else token = null;
        return 1;
      },
    };
    redis.getClient = () =>
      client as unknown as ReturnType<RedisService['getClient']>;
    const running = redis.withLock('long-job', 120, async () => {
      await Bun.sleep(300);
      return 'done';
    });
    await Bun.sleep(200);
    expect(await redis.tryAcquireLock('long-job', 120)).toBeNull();
    expect(await running).toEqual({ acquired: true, value: 'done' });
  });

  const liveUrl = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL;
  if (liveUrl) {
    it('acquires CAS locks, caches keys, and increments throttler counters in live Redis', async () => {
      const redis = new RedisService(
        createTestAppConfig({ REDIS_URL: liveUrl }),
      );
      const storage = new RedisThrottlerStorage(redis);
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const lockKey = `test:lock:${suffix}`;
      const cacheKey = `test:cache:${suffix}`;
      const bucketKey = `test-throttle-${suffix}`;

      try {
        await redis.onModuleInit();
        await expect(redis.ping()).resolves.toBeUndefined();

        await redis.setCached(cacheKey, '{"ok":true}', 10_000);
        expect(await redis.getCached(cacheKey)).toBe('{"ok":true}');

        const token = await redis.tryAcquireLock(lockKey, 10_000);
        expect(token).toBeTruthy();
        expect(await redis.tryAcquireLock(lockKey, 10_000)).toBeNull();
        // Wrong token must not release another owner's lock
        await redis.releaseLock(lockKey, 'wrong-token');
        expect(await redis.tryAcquireLock(lockKey, 10_000)).toBeNull();
        await redis.releaseLock(lockKey, token!);
        const nextToken = await redis.tryAcquireLock(lockKey, 10_000);
        expect(nextToken).toBeTruthy();
        await redis.releaseLock(lockKey, nextToken!);

        const first = await storage.increment(bucketKey, 60_000, 2, 0, 'api');
        const second = await storage.increment(bucketKey, 60_000, 2, 0, 'api');
        const third = await storage.increment(bucketKey, 60_000, 2, 0, 'api');
        expect(first.totalHits).toBe(1);
        expect(first.isBlocked).toBe(false);
        expect(second.totalHits).toBe(2);
        expect(second.isBlocked).toBe(false);
        expect(third.totalHits).toBe(3);
        expect(third.isBlocked).toBe(true);
        expect(third.timeToExpire).toBeLessThanOrEqual(60);
        expect(third.timeToBlockExpire).toBeLessThanOrEqual(60);
      } finally {
        storage.onApplicationShutdown();
        await redis.onApplicationShutdown();
      }
    });
  }
});
