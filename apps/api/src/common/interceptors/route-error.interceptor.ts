import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OnRouteError } from 'common/decorators/on-route-error.decorator';
import { catchError, type Observable } from 'rxjs';
import { logger } from 'utils/logger';

@Injectable()
export class RouteErrorInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get(OnRouteError, context.getHandler());
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpException || !options) throw error;
        logger.error(options.event, { error });
        throw new InternalServerErrorException(options.message);
      }),
    );
  }
}
