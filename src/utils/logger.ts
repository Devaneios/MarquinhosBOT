import { createLogger, transports, format } from 'winston';

export const logger = createLogger({
  transports: [new transports.Console()],
  format: format.combine(
    format.timestamp({ format: 'DD/MM/YY HH:mm:ss' }),
    format.simple(),
    format.printf(
      (msg) => `${msg.timestamp} [${msg.level.toUpperCase()}] ${msg.message}`
    )
  ),
});
