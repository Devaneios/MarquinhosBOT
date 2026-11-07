import {
  Catch,
  HttpException,
  Injectable,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { AppConfig } from 'config/app.config';
import type { Request, Response } from 'express';
import { logger } from 'utils/logger';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly config: AppConfig) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      logger.error('http.unhandled_error', { error: exception });
      const message = this.config.isProduction
        ? 'Internal Server Error'
        : exception instanceof Error
          ? exception.message
          : String(exception);
      res.status(500).json({ message });
      return;
    }

    const status = exception.getStatus();
    if (status === 413) {
      res.status(413).json({ message: 'Request body too large' });
      return;
    }
    const malformedJson =
      Reflect.get(exception, 'cause') instanceof SyntaxError ||
      exception.message.startsWith('JSON Parse error:') ||
      exception.message === 'Unexpected end of JSON input' ||
      exception.message.includes('is not valid JSON');
    if (status === 400 && malformedJson) {
      res.status(400).json({ message: 'Invalid JSON body' });
      return;
    }

    // Nest 12's Express 5 adapter installs its not-found handler as a wildcard
    // route, so `req.route` is set for that handler too. Keep the legacy
    // unmatched-route response by recognizing Nest's generated NotFoundException.
    const isNestNotFoundHandler =
      exception.message === `Cannot ${req.method} ${req.originalUrl}`;
    if (status === 404 && (!req.route || isNestNotFoundHandler)) {
      res.status(404).json({ message: 'Route not found' });
      return;
    }

    const response = exception.getResponse();
    const body =
      typeof response === 'string'
        ? { message: response }
        : isRecord(response)
          ? response
          : { message: exception.message };
    const { statusCode: _statusCode, error: _error, ...publicBody } = body;
    res.status(status).json(publicBody);
  }
}
