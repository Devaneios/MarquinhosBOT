const dj = require("./../utils/dj").dj;
const manager = require("./../utils/management").manager;
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

        if (manager.volumeRef) await manager.volumeRef.delete();

        manager.volumeEmbed = criarEmbed("Volume");
        manager.volumeEmbed.setDescription(
            `Volume atual: ${Math.round(dj.volume * 100)}%`
        );
        manager.volumeEmbed.setFooter("Reaja para aumentar ou abaixar o volume");

        manager.volumeRef = await message.channel.send(manager.volumeEmbed);
        await manager.volumeRef.react("⬆");
        await manager.volumeRef.react("⬇");

        const reactionCollector = new Discord.ReactionCollector(
            manager.volumeRef,
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
                    manager.volumeEmbed.setDescription(
                        `Volume atual: ${Math.round(dj.volume * 100)}%`
                    );
                    manager.volumeRef.edit(manager.volumeEmbed);
                }
            } else if (newReaction.emoji.name === "⬇") {
                newReaction.users.remove(user.id);
                if (dj.volume >= 0.1) {
                    dj.volume -= 0.1;
                    if(dj.playingMusic) dj.musicDispatcher.setVolume(dj.volume);
                    manager.volumeEmbed.setDescription(
                        `Volume atual: ${Math.round(dj.volume * 100)}%`
                    );
                    manager.volumeRef.edit(manager.volumeEmbed);
                }
            }
        });

        reactionCollector.on("end", async (newReaction, user) => {
            manager.volumeRef.delete();
            manager.volumeRef = null;
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
