import { ChannelType, Message } from "discord.js";
import { checkPermissions, sendTimedMessage } from "../utils/discord";
import { BotEvent } from "../types";
import { logger } from "../utils/logger";
import BotError from "../utils/botError";
import FuzzySearch from "fuzzy-search";

const event: BotEvent = {
	name: "messageCreate",
	execute: async (message: Message) => {
		const prefix = process.env.PREFIX;
		const timedMessageDuration = 10000;
		if (!message.member || message.member.user.bot) return;
		if (!message.guild) return;
		if (!message.content.startsWith(prefix)) return;
		if (message.channel.type !== ChannelType.GuildText) return;

		let args = message.content.substring(prefix.length).split(" ");
		let command = message.client.commands.get(args[0]);

		if (!command) {
			const commandList = message.client.commands;
			let commandFromAlias = commandList.find((command) =>
				command.aliases.includes(args[0])
			);
			if (commandFromAlias) command = commandFromAlias;
			else {
				const mapedCommands = commandList.map(
					(command) => command.name
				);
				const searcher = new FuzzySearch(mapedCommands, undefined, {
					sort: true,
				});
				const result = searcher.search(args[0]);
				if (result.length > 0) {
					message.channel.send(
						`Você quis dizer: **${prefix}${result[0]}** ?`
					);
				}
				throw new BotError("Command not found", message, "info");
			}
		}

		let cooldown = message.client.cooldowns.get(
			`${command.name}-${message.member.user.username}`
		);
		let neededPermissions = checkPermissions(
			message.member,
			command.permissions
		);
		if (neededPermissions !== null) {
			sendTimedMessage(
				`
            Você não tem permissão para usar esse comando. 
            \n Permissões necessárias: ${neededPermissions.join(", ")}
            `,
				message.channel,
				timedMessageDuration
			);
			throw new BotError(
				`${message.member?.user.username} missed permissions`,
				message,
				"warn"
			);
		}

		if (command.cooldown && cooldown) {
			if (Date.now() < cooldown) {
				sendTimedMessage(
					`Vai com calma! Você pode usar esse comando novamente daqui ${Math.floor(
						Math.abs(Date.now() - cooldown) / 1000
					)} segundos.`,
					message.channel,
					timedMessageDuration
				);
				throw new BotError(
					`${message.member?.user.username} exceed cooldown`,
					message,
					"warn"
				);
			}
			message.client.cooldowns.set(
				`${command.name}-${message.member.user.username}`,
				Date.now() + command.cooldown * 1000
			);
			setTimeout(() => {
				message.client.cooldowns.delete(
					`${command?.name}-${message.member?.user.username}`
				);
			}, command.cooldown * 1000);
		} else if (command.cooldown && !cooldown) {
			message.client.cooldowns.set(
				`${command.name}-${message.member.user.username}`,
				Date.now() + command.cooldown * 1000
			);
		}
		logger.info(
			`${message.member?.user.username} executing command: ${
				args ? args.join(" ") : ""
			}`
		);
		command.execute(message, args);
	},
};

export default event;
