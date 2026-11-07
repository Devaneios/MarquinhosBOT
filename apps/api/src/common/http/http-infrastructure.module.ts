import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ApiExceptionFilter } from 'common/filters/api-exception.filter';
import { JsonLogger } from 'common/logging/json-logger.service';
import { ConfigModule } from 'config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [
    JsonLogger,
    ApiExceptionFilter,
    { provide: APP_FILTER, useExisting: ApiExceptionFilter },
  ],
  exports: [JsonLogger],
})
export class HttpInfrastructureModule {}
