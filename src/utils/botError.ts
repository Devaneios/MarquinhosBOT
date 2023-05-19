import { CommandInteraction, Message, User } from "discord.js";
import { BotErrorLogLevel, SafeAny } from "../types";

class BotError extends Error {
	discordMessage: Message | CommandInteraction;
	logLevel: BotErrorLogLevel = "error";

	constructor(
		message: string,
		discordMessage: Message | CommandInteraction,
		logLevel?: BotErrorLogLevel
	) {
		super(message);
		this.name = "MarquinhosError";
		this.discordMessage = discordMessage;
		this.logLevel = logLevel ?? "error";
	}
}

export default BotError;
