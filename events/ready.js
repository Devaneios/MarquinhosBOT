const animalLottery = require("./../utils/animalLottery");
const roleta = require("./../utils/adminRoulette");
const manager = require("./../utils/management").manager;
const timeEnum = require("../utils/timeEnum").timeEnum;
const movieTheaterService =
	require("./../services/movieTheaterService").movieTheaterService;
const moment = require("moment");
const Discord = require("discord.js");

const welcome_message = ` __  __                       _       _               ____   ____ _______ 
|  \\/  |                     (_)     | |             |  _ \\ / __ \\__   __|
| \\  / | __ _ _ __ __ _ _   _ _ _ __ | |__   ___  ___| |_) | |  | | | |   
| |\\/| |/ _' | '__/ _' | | | | | '_ \\| '_ \\ / _ \\/ __|  _ <| |  | | | |   
| |  | | (_| | | | (_| | |_| | | | | | | | | (_) \\__ \\ |_) | |__| | | |   
|_|  |_|\\__,_|_|  \\__, |\\__,_|_|_| |_|_| |_|\\___/|___/____/ \\____/  |_|   
                     | |          
                     |_|`;

const marquinhos = `
              ██████████████████████████████████████████████████████████
              ███▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀███
     ████████████                                                    ███
     ████████████                                                    ███
     ████████████                                                    ███
     ████████████      ████████████                ███████████▌      ███
     ████████████      ████████████                ███████████▌      ███
     ████████████      ████████████                ███████████▌      ███
     ████████████      ████████████                ███████████▌      ███
▐████████████████      ████████████                ███████████▌      ███
▐████████████████      ████████████                ███████████▌      ███
▐████████████████                                                    ███
▐████████████████                                                    ███
     ████████████               ███             ███                  ███
     ████████████               ███             ███                  ███
     ████████████               ███████████████████                  ███
     ████████████               ███████████████████                  ███
     ████████████                                                    ███
     ████████████                                                    ███
     ████████████                                    MarquinhosBOT   ███
     ████████████                                                    ███
              ██████████████████████████████████████████████████████████
              ██████████████████████████████████████████████████████████`;

module.exports = async (client) => {
	console.log(marquinhos);
	//console.log(welcome_message);
	client.user.setActivity(getActivity());
	//updateServers(client);
	//client.user.setActivity('Jogos especiais para que todo mundo tenha um feliz ano novo ✨!')
	//client.user.setAvatar('./resources/images/marquinhosnatal.png');
	//client.user.setAvatar('./resources/images/marquinhoshead.jpg');
	//client.user.setActivity("NADA PORQUE ESTOU EM MODO DEVELOPMENT");
	setInterval(function () {
		client.user.setActivity(getActivity());
	}, 100 * 1000);
	var counter = 0;
	let guild = client.guilds.cache.find(
		(guild) => guild.name === process.env.GUILD_NAME
	);
	setInterval(async function () {
		try {
			await roleta.roulette(counter, guild);
		} catch (error) {
			console.log(error);
		}
		counter = (counter + 1) % 5;
	}, 6 * timeEnum.HOUR);
	
    await loadMovieSessionsFromDB(client);
    
	setInterval(
		sendMovieSessionsNotification.bind(this, client),
		timeEnum.SECOND
	);
};

async function sendMovieSessionsNotification(client) {
	let startingSessions = await movieTheaterService.getStartingSessions();
	for (const session of startingSessions) {
        let server = await client.guilds.cache.get(session.serverRef);
		let users = await getUsersFromSession(server, session);
		let embed = createNotificationEmbed(server, session);
		for (const user of users) {
			await user.send(embed);
		}
	}
}

async function getUsersFromSession(server, session) {
	let oldMessage = await server.channels.cache
		.get(session.channelRef)
		.messages.fetch(session.messageRef);
	let reactions = await oldMessage.reactions.cache.get("🍿");
	let users = await reactions.users.fetch();
	return users.map((user) => user).filter((user) => !user.bot);
}

function createNotificationEmbed(server, session){
    return new Discord.MessageEmbed()
    .setTitle(
        `A sua sessão no ${server.name} vai começar em 10 minutos`
    )
    .setColor("#0099ff")
    .setThumbnail(session.movie.thumbnail)
    .addField(session.movie.title, session.movie.description);
}

function getActivity() {
	return process.env.MODE == "DEVELOPMENT"
		? "NADA PORQUE ESTOU EM MODO DEVELOPMENT"
		: animalLottery.get_bicho();
}

async function loadMovieSessionsFromDB(client){
    const servers = client.guilds.cache.map((guild) => guild);
	let now = moment();
	for (const server of servers) {
		await movieTheaterService.loadMovieSessionsFromDB(
			server.id,
			now.toDate()
		);
	}
}