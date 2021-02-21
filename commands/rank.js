module.exports = {
    name: "rank",
    description: "Tabelinha dos sem vida pra mostrar quem passa mais tempo virado em call",
    usage: "!rank",
    execute(message, args) {
        message.channel.send("Todo mundo tem vida aparentemente");
    },
    // count(client, member, args) {
    //     client.channels.cache.get(process.env.BOT_TESTING_CHANNEL_ID).send(`Tô de olho viu <@${member.user.id}>! 👀`)
    // }
}
