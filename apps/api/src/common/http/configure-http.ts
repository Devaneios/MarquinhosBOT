import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppConfig } from 'config/app.config';
import cors, { type CorsOptionsDelegate } from 'cors';
import type { Request } from 'express';
import morgan from 'morgan';

const MORGAN_FORMAT =
  ':remote-addr :remote-user :method :url HTTP/:http-version :status :res[content-length] - :response-time ms';

export interface ConfigureHttpOptions {
  silent?: boolean;
}

export function configureHttp(
  app: NestExpressApplication,
  options: ConfigureHttpOptions = {},
): void {
  const config = app.get(AppConfig);
  app.setGlobalPrefix('api');
  app.set('trust proxy', 1);
  app.use(
    options.silent
      ? morgan(MORGAN_FORMAT, { stream: { write: () => undefined } })
      : morgan(MORGAN_FORMAT),
  );
  app.useBodyParser('json');

  const corsOptionsDelegate: CorsOptionsDelegate<Request> = (req, callback) => {
    callback(null, {
      origin: config.corsOrigins.includes(req.header('Origin') ?? ''),
      credentials: true,
    });
  };
  app.use(cors(corsOptionsDelegate));
  app.useBodyParser('urlencoded', { extended: true });
}
