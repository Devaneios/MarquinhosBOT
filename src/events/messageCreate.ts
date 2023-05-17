import { ChannelType, Message } from "discord.js";
import { checkPermissions, sendTimedMessage } from "../utils/discord";
import { BotEvent } from "../types";

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
			let commandFromAlias = message.client.commands.find((command) =>
				command.aliases.includes(args[0])
			);
			if (commandFromAlias) command = commandFromAlias;
			else return;
		}

		let cooldown = message.client.cooldowns.get(
			`${command.name}-${message.member.user.username}`
		);
		let neededPermissions = checkPermissions(
			message.member,
			command.permissions
		);
		if (neededPermissions !== null)
			return sendTimedMessage(
				`
            Você não tem permissão para usar esse comando. 
            \n Permissões necessárias: ${neededPermissions.join(", ")}
            `,
				message.channel,
				timedMessageDuration
			);

		if (command.cooldown && cooldown) {
			if (Date.now() < cooldown) {
				sendTimedMessage(
					`Vai com calma! Você pode usar esse comando novamente daqui ${Math.floor(
						Math.abs(Date.now() - cooldown) / 1000
					)} segundos.`,
					message.channel,
					timedMessageDuration
				);
				return;
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

		command.execute(message, args);
	},
};

export default event;
