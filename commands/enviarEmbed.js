const manage = require("../utils/management").manage;
const Discord = require("discord.js");
const fs = require("fs");
var request = require("request");

module.exports = {
	name: "enviar-embed",
	description: "Default fallback message",
	usage: "!enviar-embed canal arquivo.json",
	hide: true,
	async execute(message, args) {
		let file = message.attachments.first();
		if (!file) return message.channel.send("Você precisa selecionar um arquivo .json");
        if (file.name.split(".").pop() != "json") return message.channel.send("Formato de arquivo inválido");
		let channelName = args[0];
		let channelFound;
		try {
			if (message.member.hasPermission("ADMINISTRATOR")) {
				message.member.guild.channels.cache.find((channel) => {
					if (channel.type == "text" && channel.name == channelName) {
						channelFound = channel;
					}
				});
				if (channelFound) {
					let newEmbed = criarEmbed("Testando embed");
					request.get(file.url, (err, res, body) => {
						let jsonEmbed;
						try {
							jsonEmbed = JSON.parse(body);
							newEmbed.setTitle(jsonEmbed.title);
							newEmbed.setDescription(
								jsonEmbed.description.slice(0, 2047)
							);
							newEmbed.setColor(jsonEmbed.color);
                            newEmbed.fields = jsonEmbed.fields;
							newEmbed.setFooter(jsonEmbed.footer);
							newEmbed.setFooter(jsonEmbed.image);
							newEmbed.setThumbnail(jsonEmbed.thumbnail);
							channelFound.send(newEmbed);
							message.delete();
						} catch (error) {
							message.reply("arquivo inválido!");
							console.log(error);
						}
					});
				} else {
					message.reply("Canal não encontrado");
				}
			} else {
				message.reply(
					"Você não tem a permissão necessária para usar esse comando"
				);
			}
		} catch (error) {
			message.reply("quebrei! :(");
			if (manage.debug) {
				manage.debugChannel.send(
					"```" + `${error.message}\n${error.stack}` + "```"
				);
			} else {
				console.log(error);
			}
		}
	},
};

function criarEmbed(title) {
	let titulo = `${title}`;
	let embed = new Discord.MessageEmbed().setTitle(titulo).setColor("#0099ff");
	return embed;
}
