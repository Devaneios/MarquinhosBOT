import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import {
  ThrottlerStorageService,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { logger } from 'common/logging/logger';
import { RedisService } from 'redis/redis.service';

const THROTTLE_INCREMENT_SCRIPT = `
local blockTtl = redis.call("PTTL", KEYS[2])
if blockTtl > 0 then
  local hits = tonumber(redis.call("GET", KEYS[1]) or ARGV[2])
  local ttl = redis.call("PTTL", KEYS[1])
  if ttl < 0 then ttl = tonumber(ARGV[1]) end
  return {hits, ttl, 1, blockTtl}
end

local hits = redis.call("INCR", KEYS[1])
if hits == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end

local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])
if blockDuration > 0 then
  if hits > limit then
    redis.call("SET", KEYS[2], "1", "PX", blockDuration)
    return {hits, ttl, 1, blockDuration}
  end
  return {hits, ttl, 0, 0}
end

if hits > limit then
  return {hits, ttl, 1, ttl}
end
return {hits, ttl, 0, 0}
`;

@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnApplicationShutdown
{
  private readonly fallback = new ThrottlerStorageService();

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const client = this.redis.getClient();
    if (!client) {
      return this.fallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }

    const hitKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle-block:${throttlerName}:${key}`;
    try {
      const raw = (await client.eval(
        THROTTLE_INCREMENT_SCRIPT,
        2,
        hitKey,
        blockKey,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];

      return {
        totalHits: Number(raw[0]),
        timeToExpire: Math.max(0, Math.ceil(Number(raw[1]) / 1000)),
        isBlocked: Number(raw[2]) === 1,
        timeToBlockExpire: Math.max(0, Math.ceil(Number(raw[3]) / 1000)),
      };
    } catch (error) {
      logger.warn('redis.throttler_fallback', { throttlerName, error });
      return this.fallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
  }

  onApplicationShutdown(): void {
    this.fallback.onApplicationShutdown();
  }
}
