import { Interaction } from "discord.js";
import { BotEvent } from "../types";
import { logger } from "../utils/logger";

const event: BotEvent = {
	name: "interactionCreate",
	execute: (interaction: Interaction) => {
		if (interaction.isChatInputCommand()) {
			const timedMessageDuration = 10000;
			const command = interaction.client.slashCommands.get(
				interaction.commandName
			);
			const cooldown = interaction.client.cooldowns.get(
				`${interaction.commandName}-${interaction.user.username}`
			);
			if (!command) return;
			if (command.cooldown && cooldown) {
				if (Date.now() < cooldown) {
					interaction.reply(
						`Vai com calma! Você pode usar esse comando novamente daqui ${Math.floor(
							Math.abs(Date.now() - cooldown) / 1000
						)} segundos.`
					);
					setTimeout(
						() => interaction.deleteReply(),
						timedMessageDuration
					);
					return;
				}
				interaction.client.cooldowns.set(
					`${interaction.commandName}-${interaction.user.username}`,
					Date.now() + command.cooldown * 1000
				);
				setTimeout(() => {
					interaction.client.cooldowns.delete(
						`${interaction.commandName}-${interaction.user.username}`
					);
				}, command.cooldown * 1000);
			} else if (command.cooldown && !cooldown) {
				interaction.client.cooldowns.set(
					`${interaction.commandName}-${interaction.user.username}`,
					Date.now() + command.cooldown * 1000
				);
			}
			command.execute(interaction);
		} else if (interaction.isAutocomplete()) {
			const command = interaction.client.slashCommands.get(
				interaction.commandName
			);
			if (!command) {
				logger.error(
					`⛔ No command matching ${interaction.commandName} was found.`
				);
				return;
			}
			try {
				if (!command.autocomplete) return;
				command.autocomplete(interaction);
			} catch (error) {
				logger.error(
					`⛔ An error occurred while executing the autocomplete for ${interaction.commandName}.`
				);
				logger.error(error);
			}
		}
	},
};

export default event;
