const dj = require('./../utils/dj').dj;
module.exports = {
    name: "volume",
    description: "Meu volume, né..",
    execute(message, args) {
        let command = args[0];
        if(!command){
            message.channel.send(`Volume atual: ${Math.round(dj.volume*100)}%`);
        }else if(command == "up" && dj.volume >= 0.9){
            message.channel.send(`Tá bom vei, pra que tu quer que eu cante mais alto?`);
        }else if(command == "down" && dj.volume < 0.1){
            message.channel.send(`Eu já tô sussurando mais que a Billie Eilish...`);
        }else if(command == "up"){
            dj.volume += 0.1;
            dj.musicDispatcher.setVolume(dj.volume);
            message.channel.send(`Volume aumentado para: ${Math.round(dj.volume*100)}%`);
        }else if(command == "down" && dj.volume >= 0.1){
            dj.volume -= 0.1;
            dj.musicDispatcher.setVolume(dj.volume);
            message.channel.send(`Diminuído pra ${Math.round(dj.volume*100)}%`);
        }else{
            message.channel.send("Volume só vai pra cima ou pra baixo");
        }
    },
};