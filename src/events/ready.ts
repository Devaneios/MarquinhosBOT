import { Client } from "discord.js";
import { BotEvent } from "../types";
import { logger } from "../utils/logger";

const event: BotEvent = {
	name: "ready",
	once: true,
	execute: (client: Client) => {
		logger.info(`🚀 Logged in as ${client.user?.tag}`);
		logger.info(`Marquinhos™ is online!`);
	},
};

export default event;
