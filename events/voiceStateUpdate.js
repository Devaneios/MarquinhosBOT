const Discord = require("discord.js");
const manage = require("./../utils/management").manage;
const player = require("./../utils/player");
const dj = require("./../utils/dj").dj;
//const rank = require("./../commands/rank");
const clock = require("../utils/clock");
module.exports = async (client, oldState, newState) => {
    let newStateChannel = newState.channel;
    let oldStateChannel = oldState.channel;
    if(newStateChannel == null && oldState.member.user.id == client.user.id){
        dj.start();
    }
    // Every time that someone enters a voice channel, we check if that person its arrested.
    if (manage.idPreso.length > 0) {
        // It's inside a try/catch so if the person disconnect, Marquinhos don't break
        try {
            // We check if the person that joined the voice channel it's arrested AND if the arrested person
            // didn't just joined the arrested channel (it prevents that the person from being moved infinitely)
            // to the arrested channel.
            if (
                manage.idPreso.includes(newState.member.id) &&
                newState.channel &&
                newState.channel.id != newState.member.guild.afkChannelID
            ) {
                newState.member.voice.setChannel(
                    newState.member.guild.afkChannelID
                );
                newState.member.send("Você está preso! :(");
            }
        } catch (error) {
            console.log(error);
        }
    }
    // User Joins a voice channel and wasn't already in one
    if (
        (oldStateChannel === null &&
        newStateChannel !== null) &&
        !newState.member.user.bot
    ) {
        let filepath;
        let weekDay = clock.getLongWeekdayWithTimeZone('pt-BR', 'America/Recife');

        switch (weekDay) {
            case "quinta-feira":
                randint = Math.floor(Math.random() * 2);
                if (randint === 1)
                    filepath = "./resources/sounds/quintafeiradaledale.mp3";
                else
                    filepath = "./resources/sounds/sextaanao.mp3";
                player.execute("", filepath, newStateChannel);
                break;
            case "sexta-feira":
                filepath = "./resources/sounds/sextafeirasim.mp3";
                player.execute("", filepath, newStateChannel);
                break;
        }

        // rank.count(newState.client, newState.member);
    }
};
