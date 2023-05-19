import { SafeAny } from "src/types";
import { logger } from "./logger";
import BotError from "./botError";

export const safeExecute = (fn: Function, ...args: SafeAny) => {
	return function () {
		fn(...args)?.catch(commandErrorHandler);
	};
};

const commandErrorHandler = (error: BotError) => {
	switch (error.logLevel) {
		case "error":
			logger.error(
				`[ERROR] ${error} while running ${error.discordMessage}\n${error.stack} `
			);
			break;
		case "warn":
			logger.warn(
				`[WARN] ${error} while running ${error.discordMessage}`
			);
			break;
		case "info":
			logger.info(
				`[INFO] ${error} while running ${error.discordMessage}`
			);
			break;
		default:
			logger.error(
				`[ERROR] ${error} while running ${error.discordMessage}\n${error.stack} `
			);
			break;
	}
};
