const movieTheaterService = require("../services/movieTheaterService").movieTheaterService;
const tmdbService = require("../services/tmdbService").tmdbService;
const moment = require("moment");
const Discord = require("discord.js");

const collectorTimeout = 60000;

module.exports = {
	name: "criar-sessao",
	description: "Envia instruções de como criar uma sessão de cinema",
	usage: "!criar-sessao",
	async execute(message, args) {
		let sessionId = await movieTheaterService.getNewSessionId();
		let movieSession = {
			id: sessionId,
			createdBy: message.author.id,
			invited: [message.author.id],
		};
		let movieResults = null;

		const filter = (collectedMessage) =>
			collectedMessage.author.id == message.author.id;
		const collector = message.channel.createMessageCollector(filter, {
			time: collectorTimeout,
		});

		collector.on("collect", onCollectorReceive);
		collector.on("end", onCollectorEnd);

		sendAndDeleteMessage(
			message,
			"Pra qual filme você quer criar a sessão?"
		);

		async function onCollectorReceive(collectedMessage) {
			let messageContent = collectedMessage.content;
			collector.resetTimer({ time: collectorTimeout });

			if (messageContent == "cancel") {
				collector.stop("cancel");
				return;
			}

			if (!movieSession.hasOwnProperty("movie")) {
				await searchMovie(messageContent);
			} else if (!movieSession.movie.hasOwnProperty("title")) {
				await setSessionMovie(messageContent);
			} else if (!movieSession.hasOwnProperty("date")) {
				await setSessionDate(messageContent);
			}
		}

		async function onCollectorEnd(collected, reason) {
			if (reason == "time") {
				movieSession = null;
				await message.channel.send(
					"Tempo limite atingido, favor iniciar o processo novamente"
				);
			} else if (reason == "cancel") {
				movieSession = null;
				await message.channel.send(
					"Criação de sessão cancelada pelo usuário"
				);
			} else {
                let embed = createEmbed(movieSession);
				let sentMessage = await message.channel.send(embed);
                sentMessage.react("🍿");
                movieSession.messageRef = sentMessage.id;
                movieSession.channelRef = sentMessage.channel.id;
                movieSession.serverRef = message.guild.id;
				await movieTheaterService.saveSession(message.guild.id, movieSession);
			}
			collected.each(deleteMessage);
			message.delete();
		}

		async function searchMovie(messageContent) {
			movieResults = await tmdbService.searchMovie(messageContent);
			if (movieResults.length == 0) {
				await sendAndDeleteMessage(
					message,
					"Não encontrei nenhum filme, poderia tentar outro nome?"
				);
			} else {
				let movieResults = await parseMovieResults();
				movieSession.movie = {};
				await sendAndDeleteMessage(message, movieResults);
			}
		}

		async function parseMovieResults() {
			let text = "```Escolha um dos filmes a seguir:\n\n";
			for (let index = 0; index < movieResults.length; index++) {
				const movie = movieResults[index];
				text += `${index + 1} - ${movie.title}\n`;
			}
			text += "```";
			return text;
		}

		async function setSessionMovie(messageContent) {
			let selected = parseInt(messageContent);
			if (
				!isNaN(selected) &&
				selected >= 1 &&
				selected <= movieResults.length
			) {
				movieSession["movie"] = {
					title: movieResults[selected - 1].title,
					description: movieResults[selected - 1].overview,
					thumbnail: `https://image.tmdb.org/t/p/w500/${
						movieResults[selected - 1].poster_path
					}`,
				};
				sendAndDeleteMessage(
					message,
					"Qual dia e hora do filme? (No formato DD/MM/AAAA HH:MM)"
				);
			} else {
				sendAndDeleteMessage(message, "Opção inválida");
			}
		}

		async function setSessionDate(messageContent) {
			let date = moment(messageContent, "DD/MM/YYYY HH:mm");
			if (date.isValid() && date.isAfter(moment())) {
				movieSession.date = date;
				collector.stop("finished");
			} else {
				await sendAndDeleteMessage(message, "Data inválida, favor informe uma nova data! Ex: 15/03/2019");
			}
		}
	},
};

async function sendAndDeleteMessage(message, text) {
	let sentMessage = await message.channel.send(text);
	sentMessage.delete({ timeout: 30000 });
}

async function deleteMessage(message) {
	await message.delete();
}

function createEmbed(movieSession) {
	let embed = new Discord.MessageEmbed()
		.setTitle(movieSession.movie.title)
		.setColor("#0099ff")
		.setThumbnail(movieSession.movie.thumbnail)
		.setDescription(movieSession.movie.description)
		.addField(
			`📅  ${movieSession.date
				.locale("pt-BR")
				.format("D [de] MMMM [de] YYYY, H:mm")}`,
			"\u200B"
		)
		.addField("Reaja com 🍿 para ser convidado", "\u200B");
	return embed;
}
