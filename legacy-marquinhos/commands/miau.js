const player = require("./../utils/player");
module.exports = {
    name: "miau",
    description: "Coitado do ovo",
    usage: "!miau",
    execute(message, args) {
        newUserChannel = message.member.voice.channel;
        player.execute(message, "./resources/sounds/miau.mp3", newUserChannel);
    },
};
