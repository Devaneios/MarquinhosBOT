module.exports = {
	name: "permitir",
	description: "Dou as permissões iniciais a um membro",
	usage: "!permitir <id_do_usuario>",
	async execute(message, args) {
		const isVIP = message.member.roles.cache.some(
			(role) => role.name === "Clientes VIP"
		);
		const containTag = args.length >= 1;

		if (!isVIP)
			return message.channel.send(
				"Você precisar ser um cliente VIP pra usar esse comando"
			);
		if (!containTag)
			return message.channel.send(
				"Você precisar digitar a tag da pessoa que você quer dar permissão"
			);

		const userTag = messageHandler(args);
		const isUserTagValid = userTag.match(/.*[^# ]#[0-9]{4}/);

		if (!isUserTagValid)
			return message.channel.send("Tag inválida, favor verificar");

		const allMembers = await message.guild.members.fetch();

		const targetUser = allMembers
			.filter((member) => member.user.tag == userTag)
			.first();

		if (!targetUser)
			return message.channel.send("Usuário não está no servidor");

		const userAlreadyHasPermission = checkUserPermission(
			targetUser,
			"Fraquinho"
		);

		if (userAlreadyHasPermission)
			return message.channel.send("Usuário já possui permissões");

		const fraquihoRole = message.guild.roles.cache.find(
			(role) => role.name === "Fraquinho"
		);
		const outsidersRole = message.guild.roles.cache.find(
			(role) => role.name === "Outsiders"
		);

		if (!fraquihoRole)
			return message.channel.send("Ninguém é fraco o suficiente");

		targetUser.roles.add(fraquihoRole);

		if (checkUserPermission(targetUser, "Outsiders")) {
			targetUser.roles.remove(outsidersRole);
		}

		setTimeout(() => {
			if (
				checkUserPermission(targetUser, "Fraquinho") &&
				!checkUserPermission(targetUser, "Outsiders")
			)
				return message.channel.send("Permissão concedida com sucesso");

			return message.channel.send("Algo deu errado, tente novamente");
		}, 500);
	},
};

function messageHandler(args) {
	return args.join(" ");
}

function checkUserPermission(user, roleName) {
	return user.roles.cache.some((role) => role.name === roleName);
}
