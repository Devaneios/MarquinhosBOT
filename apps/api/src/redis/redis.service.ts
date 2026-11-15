import {
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { logger } from 'common/logging/logger';
import { AppConfig } from 'config/app.config';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

const RENEW_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`;

const REDIS_PING_TIMEOUT_MS = 1_500;
const LOCAL_CACHE_MAX_ENTRIES = 5_000;

export function createRedisClient(url: string, label = 'default'): Redis {
  const client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 3_000,
    commandTimeout: 3_000,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    retryStrategy(times) {
      return Math.min(times * 200, 3_000);
    },
  });
  client.on('error', (error) => {
    logger.warn('redis.client_error', { label, error });
  });
  return client;
}

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly url: string | undefined;
  private client: Redis | null = null;
  private readonly localLocks = new Map<string, string>();
  private readonly localCache = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  constructor(config: AppConfig) {
    this.url = config.redisUrl;
  }

  get isConfigured(): boolean {
    return Boolean(this.url);
  }

  get redisUrl(): string | undefined {
    return this.url;
  }

  getClient(): Redis | null {
    if (!this.url) return null;
    if (!this.client) {
      this.client = createRedisClient(this.url, 'shared');
    }
    return this.client;
  }

  createScopedClient(label: string): Redis | null {
    if (!this.url) return null;
    return createRedisClient(this.url, label);
  }

  async onModuleInit(): Promise<void> {
    const client = this.getClient();
    if (!client) return;
    if (client.status === 'wait') {
      await client.connect().catch((error) => {
        logger.warn('redis.connect_failed', { error });
      });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (!client) return;
    await client.quit().catch(() => {
      client.disconnect();
    });
  }

  async ping(timeoutMs: number = REDIS_PING_TIMEOUT_MS): Promise<void> {
    const client = this.getClient();
    if (!client) return;
    if (client.status === 'wait') {
      await client.connect();
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        client.ping(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Redis ping timeout')),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async getCached(key: string): Promise<string | null> {
    const client = this.getClient();
    if (client) {
      try {
        return await client.get(key);
      } catch (error) {
        logger.warn('redis.get_failed', { key, error });
        return null;
      }
    }
    const entry = this.localCache.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.localCache.delete(key);
      return null;
    }
    return entry.value;
  }

  async setCached(key: string, value: string, ttlMs: number): Promise<void> {
    if (ttlMs <= 0) return;
    const client = this.getClient();
    if (client) {
      try {
        await client.set(key, value, 'PX', ttlMs);
        return;
      } catch (error) {
        logger.warn('redis.set_failed', { key, error });
        return;
      }
    }
    if (this.localCache.size >= LOCAL_CACHE_MAX_ENTRIES) {
      const oldestKey = this.localCache.keys().next().value;
      if (oldestKey !== undefined) this.localCache.delete(oldestKey);
    }
    this.localCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async tryAcquireLock(key: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    const client = this.getClient();
    if (client) {
      try {
        const result = await client.set(key, token, 'PX', ttlMs, 'NX');
        return result === 'OK' ? token : null;
      } catch (error) {
        logger.warn('redis.lock_acquire_failed', { key, error });
        return null;
      }
    }
    if (this.localLocks.has(key)) return null;
    this.localLocks.set(key, token);
    return token;
  }

  async releaseLock(key: string, token: string): Promise<void> {
    const client = this.getClient();
    if (client) {
      try {
        await client.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
      } catch (error) {
        logger.warn('redis.lock_release_failed', { key, error });
      }
      return;
    }
    if (this.localLocks.get(key) === token) {
      this.localLocks.delete(key);
    }
  }

  async withLock<T>(
    key: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<{ acquired: true; value: T } | { acquired: false }> {
    const token = await this.tryAcquireLock(key, ttlMs);
    if (!token) return { acquired: false };
    const client = this.getClient();
    let renewal: Promise<void> | undefined;
    const timer = client
      ? setInterval(
          () => {
            if (renewal) return;
            renewal = client
              .eval(RENEW_LOCK_SCRIPT, 1, key, token, ttlMs)
              .then((result) => {
                if (result !== 1) logger.warn('redis.lock_lost', { key });
              })
              .catch((error: unknown) => {
                logger.warn('redis.lock_renew_failed', { key, error });
              })
              .finally(() => {
                renewal = undefined;
              });
          },
          Math.max(1, Math.floor(ttlMs / 3)),
        )
      : undefined;
    try {
      return { acquired: true, value: await fn() };
    } finally {
      clearInterval(timer);
      await renewal;
      await this.releaseLock(key, token);
    }
  }
}
