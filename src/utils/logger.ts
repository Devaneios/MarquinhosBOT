"use strict";

import { createLogger, transports, format } from "winston";

const colorizer = format.colorize();

export const logger = createLogger({
	transports: [new transports.Console()],
	format: format.combine(
		format.timestamp({ format: "DD-MM-YY HH:MM:SS" }),
		format.simple(),
		format.printf((msg) =>
			colorizer.colorize(msg.level, `${msg.timestamp}: ${msg.message}`)
		)
	),
});
