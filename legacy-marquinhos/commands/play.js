const manager = require("./../utils/management").manager;
const searcher = require("./../utils/youtubeSearch");
const dj = require("./../utils/dj").dj;
const Discord = require("discord.js");
module.exports = {
    name: "play",
    aliases: ["p"],
    description: "Eu toco uma música",
    usage: "!play | !p",
    async execute(message, args) {
        let newUserChannel = message.member.voice.channel;
        if (args.length == 0)
            return message.channel.send(
                "Você deve informar pelo menos um termo de busca!"
            );
        let searchTerm = args.join(" ");
        if (!newUserChannel) {
            message.channel.send(
                "Você deve estar em um canal de voz para usar esse comando!"
            );
        } else {
            let result;
            try {
                 result = await searcher.search(true, searchTerm);
            } catch (error) {
                throw error;
            }
            
            if (
                dj.musicQueue.length == 0 &&
                !dj.playingMusic &&
                !dj.playingAudio
            ) {
                dj.musicQueue.push(result);
                dj.seek = 0;
                dj.playMusic(newUserChannel, 0);
                manager.nowPlaying = criarEmbed("Tocando agora");
                manager.nowPlaying.addField(result.title, result.duration);
                manager.nowPlayingRef = await message.channel.send(
                    manager.nowPlaying
                );
            } else {
                dj.musicQueue.push(result);
                let newEmbed = criarEmbed("Adicionado à fila");
                newEmbed.addField(result.title, result.duration);
                message.channel.send(newEmbed);
            }
        }
    },
};

function criarEmbed(title) {
    let titulo = `${title}`;
    let embed = new Discord.MessageEmbed().setTitle(titulo).setColor("#0099ff");
    return embed;
}
