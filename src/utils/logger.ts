import { createLogger, transports, format, addColors } from 'winston';

addColors({
  info: 'blue',
  warn: 'yellow',
  error: 'bold red',
});

const colorizer = format.colorize();

export const logger = createLogger({
  transports: [new transports.Console()],
  format: format.combine(
    format.timestamp({ format: 'DD/MM/YY HH:mm:ss' }),
    format.simple(),
    format.printf((msg) =>
      colorizer.colorize(
        msg.level,
        `${msg.timestamp} [${msg.level.toUpperCase()}] ${msg.message}`
      )
    )
  ),
});
