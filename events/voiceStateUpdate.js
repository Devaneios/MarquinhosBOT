const Discord = require("discord.js");
const manage = require("./../utils/management").manage;
const player = require("./../utils/player");
const dj = require("./../utils/dj").dj;
const database = require("../utils/database").database;
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
		userChangedVoiceState(client, oldStateChannel, newState);
	}
};

//User Joins a voice channel and wasn't already in one
async function userJoinedVoiceChannel(client, oldState, newState) {
	if (newState.member.user.bot) return;
	console.log(await isUserArrested(newState));
	if (await isUserArrested(newState)) await arrestUser(newState);

	if (!(await isUserAlone(newState))) await startCountTime(newState);

	// Cooldown condition
	if (manage.vStateUpdateTimestamp + manage.vStateUpdateCD - Date.now() > 0) {
		//Cooldown recieves - 15 minutes
		manage.vStateUpdateCD -= 900000;
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
				player.execute("", filepath, newStateChannel);
				break;
			case "sexta-feira":
				filepath = "./resources/sounds/sextafeirasim.mp3";
				player.execute("", filepath, newStateChannel);
				break;
		}
		//Timestamp resets
		manage.vStateUpdateTimestamp = Date.now();
		//Cooldown Resets
		manage.vStateUpdateCD = 3600 * 1000;
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
}

// We check if the person that joined the voice channel it's arrested AND if the arrested person
// didn't just joined the arrested channel (it prevents that the person from being moved infinitely)
// to the arrested channel.
async function isUserArrested(newState) {
	return (
		manage.idPreso.includes(newState.member.id) &&
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
	const members = channel.members
		.filter((member) => !member.user.bot)
		.map((member) => member);
	if (members.length > 1) return false;
	return true;
}

async function startCountTime(newState) {
	console.log(manage.timer);
	const channel = newState.channel;
	const members = channel.members
		.filter((member) => !member.user.bot)
		.map((member) => member.id);
	console.log("Linha 118", members);
	for (const id of members) {
		if (!manage.timer[id]) {
			manage.timer[id] = Date.now();
		}
	}
	console.log(manage.timer);
}

async function stopCountTime(oldState) {
	console.log(manage.timer);
	const channel = oldState.channel;
	let membersLeft = channel.members
		.filter((member) => !member.user.bot)
		.map((member) => member.id);
	if (membersLeft.length == 1) {
		membersLeft.push(oldState.member.user.id);
	} else {
		membersLeft = [oldState.member.user.id];
	}
	console.log(membersLeft);
	const membersTime = membersLeft.map((id) => {
		if (manage.timer[id])
			return { id: id, time: Date.now() - parseInt(manage.timer[id]) };
	});
	for (const member of membersTime) {
		if (!member) continue;
		let userCurrentTime = await database.getUserData(
			oldState.guild.id,
			member.id,
			"time"
		);
		console.log(member.time);
		manage.timer[member.id] = null;
		await database.updateUserData(
			oldState.guild.id,
			member.id,
			"time",
			userCurrentTime + member.time
		);
	}
	console.log(manage.timer);
}
