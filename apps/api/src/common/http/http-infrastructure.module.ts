import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ApiExceptionFilter } from 'common/filters/api-exception.filter';
import { RouteErrorInterceptor } from 'common/interceptors/route-error.interceptor';
import { JsonLogger } from 'common/logging/json-logger.service';
import { ConfigModule } from 'config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [
    JsonLogger,
    ApiExceptionFilter,
    { provide: APP_FILTER, useExisting: ApiExceptionFilter },
    RouteErrorInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: RouteErrorInterceptor },
  ],
  exports: [JsonLogger],
})
export class HttpInfrastructureModule {}
