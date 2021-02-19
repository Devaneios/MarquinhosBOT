const dj = require("./../utils/dj").dj;
const manage = require("./../utils/management").manage;
const Discord = require("discord.js");
module.exports = {
    name: "volume",
    description: "Meu volume, né..",
    usage: "!volume",
    async execute(message, args) {
        let command = args[0];
        let newUserChannel = message.member.voice.channel;
        if (!newUserChannel) {
            await message.channel.send(
                "Você deve estar em um canal de voz para usar esse comando!"
            );
        }

        if (manage.volumeRef) await manage.volumeRef.delete();

        manage.volumeEmbed = criarEmbed("Volume");
        manage.volumeEmbed.setDescription(
            `Volume atual: ${Math.round(dj.volume * 100)}%`
        );
        manage.volumeEmbed.setFooter("Reaja para aumentar ou abaixar o volume");

        manage.volumeRef = await message.channel.send(manage.volumeEmbed);
        await manage.volumeRef.react("⬆");
        await manage.volumeRef.react("⬇");

        const reactionCollector = new Discord.ReactionCollector(
            manage.volumeRef,
            (newReaction, user) =>
                !user.bot &&
                (newReaction.emoji.name === "⬆" ||
                    newReaction.emoji.name === "⬇"),
            { time: 60000 }
        );

        reactionCollector.on("collect", async (newReaction, user) => {
            if (newReaction.emoji.name === "⬆") {
                newReaction.users.remove(user.id);
                if (dj.volume <= 0.9) {
                    dj.volume += 0.1;
                    if(dj.playingMusic) dj.musicDispatcher.setVolume(dj.volume);
                    manage.volumeEmbed.setDescription(
                        `Volume atual: ${Math.round(dj.volume * 100)}%`
                    );
                    manage.volumeRef.edit(manage.volumeEmbed);
                }
            } else if (newReaction.emoji.name === "⬇") {
                newReaction.users.remove(user.id);
                if (dj.volume >= 0.1) {
                    dj.volume -= 0.1;
                    if(dj.playingMusic) dj.musicDispatcher.setVolume(dj.volume);
                    manage.volumeEmbed.setDescription(
                        `Volume atual: ${Math.round(dj.volume * 100)}%`
                    );
                    manage.volumeRef.edit(manage.volumeEmbed);
                }
            }
        });

        reactionCollector.on("end", async (newReaction, user) => {
            manage.volumeRef.delete();
            manage.volumeRef = null;
        });
        // if(!command){
        //     message.channel.send(`Volume atual: ${Math.round(dj.volume*100)}%`);
        // }else if(command == "up" && dj.volume >= 0.9){
        //     message.channel.send(`Tá bom vei, pra que tu quer que eu cante mais alto?`);
        // }else if(command == "down" && dj.volume < 0.1){
        //     message.channel.send(`Eu já tô sussurando mais que a Billie Eilish...`);
        // }else if(command == "up"){
        //     dj.volume += 0.1;
        //     dj.musicDispatcher.setVolume(dj.volume);
        //     message.channel.send(`Volume aumentado para: ${Math.round(dj.volume*100)}%`);
        // }else if(command == "down" && dj.volume >= 0.1){
        //     dj.volume -= 0.1;
        //     dj.musicDispatcher.setVolume(dj.volume);
        //     message.channel.send(`Diminuído pra ${Math.round(dj.volume*100)}%`);
        // }else{
        //     message.channel.send("Volume só vai pra cima ou pra baixo");
        // }
    },
};

function criarEmbed(title) {
    let titulo = `${title}`;
    let embed = new Discord.MessageEmbed().setTitle(titulo).setColor("#0099ff");
    return embed;
}
