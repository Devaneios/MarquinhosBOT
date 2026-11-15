import { Module } from '@nestjs/common';
import { ConfigModule } from 'config/config.module';
import { DatabaseModule } from 'database/database.module';
import { HealthController } from 'modules/health/health.controller';
import { RedisModule } from 'redis/redis.module';

@Module({
  imports: [ConfigModule, DatabaseModule, RedisModule],
  controllers: [HealthController],
})
export class HealthModule {}
