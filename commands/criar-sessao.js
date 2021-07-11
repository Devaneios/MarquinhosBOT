const movieTheaterService =
	require("../services/movieTheaterService").movieTheaterService;

const tmdbService = require("../services/tmdbService").tmdbService;
const moment = require("moment");
const Discord = require("discord.js");

module.exports = {
	name: "criar-sessao",
	description: "Envia instruções de como criar uma sessão de cinema",
	usage: "!criar-sessao",
	async execute(message, args) {
		let sessionId = await movieTheaterService.startCreateSession(
			message.author.id
		);

		let first, second, third;
		let trash = [];
		let movieResults;

		first = await message.channel.send(
			"Pra qual filme você quer criar a sessão?"
		);
		const filter = (collectedMessage) =>
			collectedMessage.author.id == message.author.id;
		const collector = message.channel.createMessageCollector(filter, {
			time: 30000,
		});

		collector.on("collect", async (m) => {
			let messageContent = m.content;
			if (first && !second && !third) {
				movieResults = await tmdbService.searchMovie(messageContent);
				if (movieResults.length == 0) {
					trash.push(first);
					first = await message.channel.send(
						"Não encontrei nenhum filme, poderia tentar outro nome?"
					);
					collector.resetTimer({ time: 30000 });
				} else {
					trash.push(first);
					first = null;
					let text = "```Escolha um dos filmes a seguir:\n\n";
					for (let index = 0; index < movieResults.length; index++) {
						const movie = movieResults[index];
						text += `${index + 1} - ${movie.title}\n`;
					}
					text += "```";
					second = await message.channel.send(text);
					collector.resetTimer({ time: 30000 });
				}
			} else if (!first && second && !third) {
				trash.push(second);
				let selected = parseInt(messageContent);
				if (
					!isNaN(selected) &&
					selected >= 1 &&
					selected <= movieResults.length
				) {
					await movieTheaterService.addMovieToSession(
						sessionId,
						movieResults[selected - 1].title,
						movieResults[selected - 1].overview,
						`https://image.tmdb.org/t/p/w500/${
							movieResults[selected - 1].poster_path
						}`
					);
					trash.push(second);
					second = null;
					third = await message.channel.send(
						"Qual dia e hora do filme? (No formato DD/MM/AAAA HH:MM)"
					);
				} else {
					trash.push(second);
					second = await message.channel.send("Opção inválida");
					collector.resetTimer({ time: 15000 });
				}
			} else if (!first && !second && third) {
				trash.push(third);
				let messageDate = messageContent.split(" ")[0];
				let messageTime = messageContent.split(" ")[1];
				if (
					moment(
						`${messageDate} ${messageTime}`,
						"DD/MM/YYYY HH:mm"
					).isValid()
				) {
					let date = moment(
						`${messageDate} ${messageTime}`,
						"DD/MM/YYYY HH:mm"
					);
					await movieTheaterService.addDateToSession(sessionId, date);
					collector.stop("pq sim");
				} else {
					third = await message.channel.send("Data inválida");
					collector.resetTimer({ time: 15000 });
				}
			}
		});

		collector.on("end", async (collected, reason) => {
			let movieSession = await movieTheaterService.getMovieSession(
				sessionId
			);
			let embed = new Discord.MessageEmbed()
				.setTitle("Sessão Devaneios de Cinema")
				.setColor("#0099ff")
				.setThumbnail(movieSession.movie.thumbnail)
				.addField(
					movieSession.movie.name,
					movieSession.movie.description
				)
				.addField(
					"📅",
					movieSession.datetime
						.locale("pt-BR")
						.format("D [de] MMMM [de] YYYY, H:mm")
				)
				.setFooter("Reaja com ... para ser convidado");
			message.channel.send(embed);
			trash.push(third);
			console.log("Excluindo as coletadas");
			await collected.forEach(deleteMessage);
			console.log("Excluindo as da lixeira");
			trash.forEach(deleteMessage);
			message.delete();
		});

		async function deleteMessage(message) {
			console.log(`Excluindo mensagem: ${message.content}`);
			await message.delete();
		}
	},
};
