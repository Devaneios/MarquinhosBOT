const player = require("./../utils/player");
const clock = require("../utils/clock");
module.exports = {
    name: "horario",
    description: "Te digo o horário. Apenas.",
    execute(message, args) {
        
        let recifeHourAndMinute = clock.getHoursAndMinutesWithTimeZone('pt-BR', 'America/Recife');
        let recifeHour = clock.getHoursWithTimeZone('pt-BR', 'America/Recife');
        newUserChannel = message.member.voice.channel;
        // If its midnight, Marquinhos enter the voice channel and ANNOUNCES that it's OLEO DE MACACO TIME
        if (recifeHour == "00") {
            filepath = "./resources/sounds/macaco.mp3";
            player.execute(message, filepath, newUserChannel);
        } else {
            // If its not midnight, Marquinhos send the time in the channel
            message.channel.send(`Agora são ${recifeHourAndMinute}`);
        }
    },
};
