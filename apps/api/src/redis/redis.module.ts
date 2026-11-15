import { Global, Module } from '@nestjs/common';
import { ConfigModule } from 'config/config.module';
import { RedisThrottlerStorage } from 'redis/redis-throttler.storage';
import { RedisService } from 'redis/redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisService, RedisThrottlerStorage],
  exports: [RedisService, RedisThrottlerStorage],
})
export class RedisModule {}
