const dj = require("./../utils/dj").dj;
module.exports = {
    name: "remove",
    aliases: ["r"],
    description: "Move a posição das músicas na fila",
    execute(message, args) {
        if(dj.musicQueue.length == 0){
            message.channel.send(
                `Man, a fila tá vazia`
            );
            return;
        }
        let position = args[0];
        if(position == "l" || position == "last"){
            message.channel.send(
                `Beleza, tirei a última música da fila`
            );
            dj.musicQueue.splice(dj.musicQueue.length - 1, 1);
            return;
        }
        position = parseInt(args[0]);
        if (isNaN(position) || position - 1 < 0 || position - 1 > dj.musicQueue.length - 1) {
            message.channel.send("Você deve informar uma posição válida!");
        } else {
            message.channel.send(
                `${dj.musicQueue[position - 1].title} removida`
            );
            dj.musicQueue.splice(position - 1, 1);
        }
    },
};