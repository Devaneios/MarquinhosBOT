import {
	Client,
	GatewayIntentBits,
	Collection,
	REST,
	Routes,
	SlashCommandBuilder,
} from "discord.js";
import { BotEvent, Command, SlashCommand } from "./types";
import { readdirSync } from "fs";
import { join } from "path";
import { logger } from "./utils/logger";

const { Guilds, MessageContent, GuildMessages, GuildMembers } =
	GatewayIntentBits;

class Bot {
	private client: Client;
	private readonly slashCommandsDir = join(__dirname, "./slashCommands");
	private readonly commandsDir = join(__dirname, "./commands");
	private readonly eventsDir = join(__dirname, "./events");

	constructor() {
		this.client = new Client({
			intents: [Guilds, MessageContent, GuildMessages, GuildMembers],
		});
		this.client.slashCommands = new Collection<string, SlashCommand>();
		this.client.commands = new Collection<string, Command>();
		this.client.cooldowns = new Collection<string, number>();
	}

	loadSlashCommands() {
		const slashCommands: SlashCommandBuilder[] = [];

		readdirSync(this.slashCommandsDir).forEach((file) => {
			try {
				if (!file.endsWith(".js")) return;

				const command: SlashCommand =
					require(`${this.slashCommandsDir}/${file}`).default;
				slashCommands.push(command.command);
				this.client.slashCommands.set(command.command.name, command);

				logger.info(
					`✅ Successfully read command ${command.command.name}`
				);
			} catch (error) {
				logger.error(`Error reading command ${file}`);
				logger.error(error);
			}
		});

		this._sendSlashCommands(slashCommands);
	}

	loadTextCommands() {
		const commands: Command[] = [];

		readdirSync(this.commandsDir).forEach((file) => {
			try {
				if (!file.endsWith(".js")) return;
				let command: Command =
					require(`${this.commandsDir}/${file}`).default;
				commands.push(command);
				this.client.commands.set(command.name, command);
				logger.info(`✅ Successfully read command ${command.name}`);
			} catch (error) {
				logger.error(
					`❌ Error loading command ${file.replace(".js", "")}`
				);
				logger.error(error);
			}
		});
	}

	loadEvents() {
		readdirSync(this.eventsDir).forEach((file) => {
			if (!file.endsWith(".js")) return;
			let event: BotEvent = require(`${this.eventsDir}/${file}`).default;
			event.once
				? this.client.once(event.name, (...args) =>
						event.execute(...args)
				  )
				: this.client.on(event.name, (...args) =>
						event.execute(...args)
				  );
			logger.info(`✅ Successfully loaded event ${event.name}`);
		});
	}

	start() {
		this.client.login(process.env.TOKEN);
	}

	private _sendSlashCommands(slashCommands: SlashCommandBuilder[]) {
		const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

		rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
			body: slashCommands.map((command) => command.toJSON()),
		})
			.then((data: any) => {
				if (!data.length) {
					logger.warn("⚠️ No slash commands loaded");
					return;
				}
				logger.info(
					`✅ Successfully loaded ${data.length} slash command(s)`
				);
			})
			.catch((e) => {
				logger.error("❌ Error loading slash commands");
				logger.error(e);
			});
	}
}

export default Bot;
