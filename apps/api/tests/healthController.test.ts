import type { Db } from '@marquinhos/database/client';
import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, mock } from 'bun:test';
import { HealthController } from 'modules/health/health.controller';
import type { RedisService } from 'redis/redis.service';
import { createTestAppConfig } from './helpers/testAppConfig';

describe('HealthController readiness checks', () => {
  it('returns ok when database and configured redis pass', async () => {
    const db = { execute: mock(async () => [{ ok: 1 }]) } as unknown as Db;
    const redis = {
      isConfigured: true,
      ping: mock(async () => undefined),
    } as unknown as RedisService;

    const controller = new HealthController(db, redis, createTestAppConfig());
    await expect(controller.getHealth()).resolves.toEqual({ status: 'ok' });
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(redis.ping).toHaveBeenCalledTimes(1);
  });

  it('throws 503 ServiceUnavailableException when postgres query fails', async () => {
    const db = {
      execute: mock(async () => {
        throw new Error('ECONNREFUSED');
      }),
    } as unknown as Db;
    const redis = {
      isConfigured: false,
      ping: mock(async () => undefined),
    } as unknown as RedisService;

    const controller = new HealthController(db, redis, createTestAppConfig());
    await expect(controller.getHealth()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('throws 503 ServiceUnavailableException when configured redis ping fails', async () => {
    const db = { execute: mock(async () => [{ ok: 1 }]) } as unknown as Db;
    const redis = {
      isConfigured: true,
      ping: mock(async () => {
        throw new Error('Redis connection is closed');
      }),
    } as unknown as RedisService;

    const controller = new HealthController(db, redis, createTestAppConfig());
    await expect(controller.getHealth()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('requires configured redis and db in production', async () => {
    const prodConfig = createTestAppConfig({ NODE_ENV: 'production' });
    const controller = new HealthController(undefined, undefined, prodConfig);
    await expect(controller.getHealth()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
