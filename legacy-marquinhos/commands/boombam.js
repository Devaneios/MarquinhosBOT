const player = require("./../utils/player");
module.exports = {
    name: "boombam",
    description: "Boombam pow",
    usage: "!boombam",
    execute(message, args) {
        newUserChannel = message.member.voice.channel;
        player.execute(message, "./resources/sounds/boombam.mp3", newUserChannel);
    },
};