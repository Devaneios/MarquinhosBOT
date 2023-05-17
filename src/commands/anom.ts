import { Message, PermissionFlagsBits, TextChannel } from "discord.js";
import { Command } from "../types";

const command: Command = {
	name: "anom",
	execute: (message: Message, args: string[]) => {
		const parsedMessage = messageHandler(args);
		const channelName = args[1];
		const desiredChannel = message.guild?.channels.cache
			.filter((channel) => channel.name === channelName)
			.first();
		if (!desiredChannel) {
			message.channel.send("Desculpe, não consegui achar esse canal! :(");
			return;
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

export default command;
