const player = require("./../utils/player");
module.exports = {
    name: "cabra",
    description: "Bééééééé",
    usage: "!cabra",
    execute(message, args) {
        newUserChannel = message.member.voice.channel;
        player.execute(message, "./resources/sounds/cabra.mp3", newUserChannel);
    },
};
