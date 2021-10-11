const Discord = require("discord.js");
const manager = require("./../utils/management").manager;
const player = require("./../utils/player");
const dj = require("./../utils/dj").dj;
const clock = require("../utils/clock");

module.exports = async (client, oldState, newState) => {
	let newStateChannel = newState.channel;
	let oldStateChannel = oldState.channel;

	if (oldStateChannel === null && newStateChannel !== null) {
		userJoinedVoiceChannel(client, oldState, newState);
	} else if (oldStateChannel !== null && newStateChannel === null) {
		userLeftVoiceChannel(client, oldState, newState);
	} else if (
		oldStateChannel !== null &&
		newStateChannel !== null &&
		oldStateChannel.id !== newStateChannel.id
	) {
		userChangedVoiceChannel(client, oldState, newState);
	} else if (
		oldStateChannel !== null &&
		newStateChannel !== null &&
		oldStateChannel.id === newStateChannel.id
	) {
		userChangedVoiceState(client, oldState, newState);
	}
};

//User Joins a voice channel and wasn't already in one
async function userJoinedVoiceChannel(client, oldState, newState) {
	if (newState.member.user.bot) return;
	if (await isUserArrested(newState)) await arrestUser(newState);
	if (!(await isUserAlone(newState))) await startCountTime(newState);

	// Cooldown condition
	if (manager.vStateUpdateTimestamp + manager.vStateUpdateCD - Date.now() > 0) {
		//Cooldown recieves - 15 minutes
		manager.vStateUpdateCD -= 900000;
	} else {
		let filepath;
		let weekDay = clock.getLongWeekdayWithTimeZone(
			"pt-BR",
			"America/Recife"
		);
		switch (weekDay) {
			case "quinta-feira":
				randint = Math.floor(Math.random() * 2);
				if (randint === 1)
					filepath = "./resources/sounds/quintafeiradaledale.mp3";
				else filepath = "./resources/sounds/sextaanao.mp3";
				player.execute("", filepath, newState.channel);
				break;
			case "sexta-feira":
				filepath = "./resources/sounds/sextafeirasim.mp3";
				player.execute("", filepath, newState.channel);
				break;
		}
		//Timestamp resets
		manager.vStateUpdateTimestamp = Date.now();
		//Cooldown Resets
		manager.vStateUpdateCD = 3600 * 1000;
	}
}

async function userLeftVoiceChannel(client, oldState, newState) {
	if (oldState.member.user.id == client.user.id) dj.start();
	if (newState.member.user.bot) return;
	await stopCountTime(oldState);
}

async function userChangedVoiceChannel(client, oldState, newState) {
	if (newState.member.user.bot) return;
	if (await isUserArrested(newState)) await arrestUser(newState);
	await stopCountTime(oldState);
	if (!(await isUserAlone(newState))) await startCountTime(newState);
}

async function userChangedVoiceState(client, oldState, newState) {
	if (newState.member.user.bot) return;
	if (newState.member.voice.selfDeaf) stopCountTime(oldState);
	else if (!(await isUserAlone(newState))) await startCountTime(newState);
}

// We check if the person that joined the voice channel it's arrested AND if the arrested person
// didn't just joined the arrested channel (it prevents that the person from being moved infinitely)
// to the arrested channel.
async function isUserArrested(newState) {
	return (
		manager.idPreso.includes(newState.member.id) &&
		newState.channel &&
		newState.channel.id != newState.member.guild.afkChannelID
	);
}

async function arrestUser(newState) {
	// a try/catch so if the person disconnect, Marquinhos don't break
	try {
		newState.member.voice.setChannel(newState.member.guild.afkChannelID);
		newState.member.send("Você está preso! :(");
	} catch (error) {
		console.log(error);
	}
}

async function isUserAlone(newState) {
	const channel = newState.channel;
	const members = await findValidUsersIds(channel);
	return members.length < 2;
}

async function startCountTime(newState) {
	const channel = newState.channel;
	const members = await findValidUsersIds(channel);
	for (const id of members) {
		if (!manager.timer[id]) {
			manager.timer[id] = Date.now();
		}
	}
}

async function stopCountTime(oldState) {
	const channel = oldState.channel;
    let currentUser = oldState.member.user.id;
	let membersLeft = await findValidUsersIds(channel);
    console.log(membersLeft);
	if (membersLeft.length == 1) {
        console.log("Stopping time for users", membersLeft);
		membersLeft.push(oldState.member.user.id);
        for (const member of membersLeft) {
            await updateUserTime(
                oldState.guild.id, 
                member, 
                Date.now() - parseInt(manager.timer[member]));
        }
	} else if(membersLeft.length == 0){
        console.log("Stopping time for users", membersLeft);
        await updateUserTime(
            oldState.guild.id, 
            currentUser, 
            Date.now() - parseInt(manager.timer[currentUser]));
	}
}

async function updateUserTime(guildId, memberId, time){
    let userCurrentTime = await database.getCollectionDocumentField(
        guildId,
        memberId,
        "time"
    );
    manager.timer[memberId] = null;
    await database.updateCollectionDocumentField(
        guildId,
        memberId,
        "time",
        userCurrentTime + time
    );
}

async function findValidUsersIds(channel) {
	return channel.members
		.filter((member) => !member.user.bot && !member.voice.selfDeaf)
		.map((member) => member.id);
}
