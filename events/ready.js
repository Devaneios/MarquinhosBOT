const animalLottery = require("./../utils/animalLottery");
const roleta = require("./../utils/adminRoulette");
const database = require("../utils/database").database;
const manager = require("./../utils/management").manager;

const welcome_message = ` __  __                       _       _               ____   ____ _______ 
|  \\/  |                     (_)     | |             |  _ \\ / __ \\__   __|
| \\  / | __ _ _ __ __ _ _   _ _ _ __ | |__   ___  ___| |_) | |  | | | |   
| |\\/| |/ _' | '__/ _' | | | | | '_ \\| '_ \\ / _ \\/ __|  _ <| |  | | | |   
| |  | | (_| | | | (_| | |_| | | | | | | | | (_) \\__ \\ |_) | |__| | | |   
|_|  |_|\\__,_|_|  \\__, |\\__,_|_|_| |_|_| |_|\\___/|___/____/ \\____/  |_|   
                     | |          
                     |_|         `;

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
     ████████████                                                    ███    
     ████████████                                                    ███    
              ██████████████████████████████████████████████████████████    
              ██████████████████████████████████████████████████████████    
`;
require("dotenv").config();
module.exports = (client) => {
	console.log(marquinhos);
	console.log(welcome_message);

	client.user.setActivity(getActivity());
	updateServers(client);
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
	deleteDebugChannelOnStart(guild);
	// client.guilds.cache.forEach(eachServer.bind(this));
	setInterval(async function () {
		try {
			await roleta.roulette(counter, guild);
		} catch (error) {
			console.log(error);
		}
		counter = (counter + 1) % 5;
	}, 6 * 3600000);
	// 6 hours * 1 hour in milliseconds
};

function getActivity() {
	return process.env.MODE == "DEVELOPMENT"
		? "NADA PORQUE ESTOU EM MODO DEVELOPMENT"
		: animalLottery.get_bicho();
}

async function deleteDebugChannelOnStart(server) {
	let channel = await server.channels.cache.find(
		(c) => c.name == "marquinhos-debug" && c.type == "text"
	);
	if (channel) {
		channel.delete();
	}
}

async function startCountOnStart(server) {
	let channels = await server.channels.cache.filter(
		(channel) => channel.type == "voice"
	);
	channels.forEach((channel) => {
		let channelMembers = channel.members
			.filter((member) => !member.user.bot)
			.map((member) => member);
		if (channelMembers.length > 1) {
			channelMembers.forEach((member) => {
				manager.timer[member.id] = Date.now();
			});
		}
	});
}

async function updateServers(client) {
	const servers = client.guilds.cache.map((guild) => guild);
	for (const server of servers) {
		await loadServer(server);
	}
}

async function loadServer(server) {
	const serverInfoFromFirebase = await database.getCollectionSnapshot(
		server.id
	);
	let serverMembers = (await server.members.fetch()).map((user) => user);
	if (serverInfoFromFirebase.empty) {
		await addAllServerUsers(server, serverMembers);
		await startCountOnStart(server);
	} else {
		const firebaseMembersId = serverInfoFromFirebase.docs.map(
			(doc) => doc.id
		);
		const serverMembersId = serverMembers.map((user) => user.id);
		await removeMemberQuit(server, firebaseMembersId, serverMembersId);
		await addNewServerUsers(server, firebaseMembersId, serverMembersId);
		await startCountOnStart(server);
	}
}

async function addNewUser(serverId, userId) {
	const collectionDocument = await database.getCollectionDocument(
		serverId,
		userId
	);
	await database.setField(collectionDocument, "preso", false);
	await database.updateField(collectionDocument, "time", 0);
	await database.updateField(collectionDocument, "quinhao", 0);
}

async function addAllServerUsers(server, serverMembers) {
	console.log(
		`${server.name} não encontrado no Firebase, adicionando membros`
	);
	for (const member of serverMembers) {
		if (!member.user.bot) {
			addNewUser(server.id, member.id);
		}
	}
}

async function removeMemberQuit(server, firebaseMembersId, serverMembersId) {
	console.log(`Removendo membros que saíram do ${server.name}`);
	for (const id of firebaseMembersId) {
		if (!serverMembersId.includes(id)) {
			database.removeCollectionDocument(server.id, id);
		}
	}
}

async function addNewServerUsers(server, firebaseMembersId, serverMembersId) {
	console.log(`Adicionando novos membros do ${server.name}`);
	for (const id of serverMembersId) {
		const memberUser = await server.members.fetch(id);
		const isBot = memberUser.user.bot;
		if (!firebaseMembersId.includes(id) && !isBot) {
			addNewUser(server.id, id);
		}
	}
}
