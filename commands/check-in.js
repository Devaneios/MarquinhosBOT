module.exports = {
	name: "check-in",
	description: "Mostra a data que você entrou no servidor",
	usage: "!check-in",
	execute(message, args) {
		let memberJoinedTimestamp = message.member.joinedTimestamp;
		let memberJoinedTimestampAsDate = new Date(memberJoinedTimestamp);
		let formatedMemberJoinedTimestamp =
			memberJoinedTimestampAsDate.toLocaleString("pt-BR", {
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
				timeZone: "America/Recife",
			});
		let dayOfTheWeekMemberJoined =
			memberJoinedTimestampAsDate.toLocaleString("pt-BR", {
				weekday: "long",
			});
		message.reply(
			`você entrou no ${message.guild.name} ${
				dayOfTheWeekMemberJoined == "sábado" ||
				dayOfTheWeekMemberJoined == "domingo"
					? "no"
					: "na"
			} ${formatedMemberJoinedTimestamp}`
		);
	},
};
