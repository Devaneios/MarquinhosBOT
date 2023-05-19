import { Message, TextChannel } from "discord.js";
import { Command } from "../types";
import BotError from "../utils/botError";
import { sendTimedMessage } from "../utils/discord";

const command: Command = {
	name: "anom",
	execute: (message: Message, args: string[]) => {
		const parsedMessage = messageHandler(args);
		const channelName = args[1];
		if (!channelName) channelNotProvided(message);
		const desiredChannel = message.guild?.channels.cache
			.filter((channel) => channel.name === channelName)
			.first();
		if (!desiredChannel) {
			channelNotFound(message, channelName);
		}
		message.delete();
		(desiredChannel as TextChannel).send(`Alguém disse: ${parsedMessage}`);
	},
	cooldown: 10,
	aliases: ["anonimo"],
	permissions: [],
};

const messageHandler = (args: string[]) => {
	return args.slice(2).join(" ");
};

const channelNotProvided = (message: Message) => {
	message.delete();
	sendTimedMessage(
		"Você precisa especificar um canal!",
		message.channel as TextChannel,
		5000
	);
	throw new BotError("Channel not specified", message, "warn");
};

const channelNotFound = (message: Message, channelName: string) => {
	message.delete();
	sendTimedMessage(
		"Desculpe, não consegui achar esse canal! :(",
		message.channel as TextChannel,
		5000
	);
	throw new BotError(`Channel ${channelName} not found`, message, "warn");
};

export default command;
