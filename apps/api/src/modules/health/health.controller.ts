import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import { health } from '@marquinhos/contracts/http/routes/health';
import type { Db } from '@marquinhos/database/client';
import {
  Controller,
  Get,
  Inject,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { logger } from 'common/logging/logger';
import { AppConfig } from 'config/app.config';
import { DB } from 'database/database.tokens';
import { sql } from 'drizzle-orm';
import { RedisService } from 'redis/redis.service';

const HEALTH_CHECK_TIMEOUT_MS = 1_500;

async function withCheckTimeout<T>(
  name: string,
  promise: Promise<T>,
  timeoutMs: number = HEALTH_CHECK_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${name} health check timed out`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Controller('health')
export class HealthController {
  constructor(
    @Optional() @Inject(DB) private readonly db?: Db,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly config?: AppConfig,
  ) {}

  @Get()
  async getHealth(): Promise<ContractResponseInput<typeof health>> {
    const checks: Promise<unknown>[] = [];

    if (this.db) {
      checks.push(withCheckTimeout('database', this.db.execute(sql`SELECT 1`)));
    } else if (this.config?.isProduction) {
      throw new ServiceUnavailableException({
        status: 'error',
        error: 'Database unavailable',
      });
    }

    if (this.redis?.isConfigured) {
      checks.push(this.redis.ping(HEALTH_CHECK_TIMEOUT_MS));
    } else if (this.config?.isProduction) {
      throw new ServiceUnavailableException({
        status: 'error',
        error: 'Redis unavailable',
      });
    }

    try {
      await Promise.all(checks);
      return { status: 'ok' };
    } catch (error) {
      logger.warn('health.check_failed', { error });
      throw new ServiceUnavailableException({
        status: 'error',
        error: 'Dependency check failed',
      });
    }
  }
}
