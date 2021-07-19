const Discord = require("discord.js");

module.exports = {
	name: "rank",
	description:
		"Tabelinha dos sem vida pra mostrar quem passa mais tempo virado em call",
	usage: "!rank",
	async execute(message, args) {
        return message.reply("Esse comando está em manutenção");
		let usersTime = await database.getDataOrdered(message.guild.id, "time", "desc", 10);
		topUsersEmbed = criarEmbed("Top 10 Clientes");
		for (let index = 0; index < usersTime.length; index++) {
			const user = usersTime[index];
			let userTime = parseTime(user.time);
			let userId = user.id;
			let userFetched = await message.guild.members.fetch(userId);
			let userDisplayName = userFetched.displayName;
			let position = `#${index + 1}`;
            let tempo = "\u200B";
			if (position == "#1") {
				position = ":first_place:";
			} else if (position == "#2") {
				position = ":second_place:";
			} else if (position == "#3") {
				position = ":third_place:";
			}
			topUsersEmbed.addField(`${position} \u2022 ${userTime}`, userDisplayName, false);
		}
		message.channel.send(topUsersEmbed);
	},
};

function criarEmbed(title) {
	let titulo = `${title}`;
	let embed = new Discord.MessageEmbed().setTitle(titulo).setColor("#0099ff");
	return embed;
}

const MILLIS_IN_A_SECOND = 1000;
const MILLIS_IN_A_MINUTE = 60 * MILLIS_IN_A_SECOND;
const MILLIS_IN_A_HOUR = 60 * MILLIS_IN_A_MINUTE;
const MILLIS_IN_A_DAY = 24 * MILLIS_IN_A_HOUR;

function parseTime(time){
    let timeInteger = parseInt(time);
    let days = Math.floor(timeInteger/MILLIS_IN_A_DAY);
    let remainingMillis = timeInteger % MILLIS_IN_A_DAY;
    let hours = Math.floor(remainingMillis/MILLIS_IN_A_HOUR);
    remainingMillis = timeInteger % MILLIS_IN_A_HOUR;
    let minutes = Math.floor(remainingMillis/ MILLIS_IN_A_MINUTE);
    remainingMillis = timeInteger % MILLIS_IN_A_MINUTE;
    let seconds = Math.floor(remainingMillis/MILLIS_IN_A_SECOND);
    let counter = 0;
    timeAsString = "";

    if(days > 0){
        if(days == 1) timeAsString += `${days}d`;
        else timeAsString += `${days}d`
        counter++;
    }
    if(hours > 0){
        if(hours == 1) timeAsString += `${hours}h`;
        else timeAsString += `${hours}h`;
        counter++;
    }
    if(minutes > 0 && counter < 2){
        if(minutes == 1) timeAsString += `${minutes}m`;
        else timeAsString += `${minutes}m`;
        counter++;
    }
    if(seconds > 0 && counter < 2){
        if(seconds == 1) timeAsString += `${seconds}s`;
        else timeAsString += `${seconds}s`;
        counter++;
    }
    if(timeAsString == "") return "0";
    return timeAsString;
}