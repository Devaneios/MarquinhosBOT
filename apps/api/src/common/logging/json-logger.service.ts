import { Injectable, type LoggerService } from '@nestjs/common';
import { logger } from 'common/logging/logger';

@Injectable()
export class JsonLogger implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    logger.info('nest.framework.log', { message, optionalParams });
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    logger.error('nest.framework.error', { message, optionalParams });
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    logger.warn('nest.framework.warn', { message, optionalParams });
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    logger.debug('nest.framework.debug', { message, optionalParams });
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    logger.debug('nest.framework.verbose', { message, optionalParams });
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    logger.error('nest.framework.fatal', { message, optionalParams });
  }
}
