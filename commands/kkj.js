const player = require("./../utils/player");
module.exports = {
    name: "kkj",
    description: "Meeeemes, piaaadas",
    usage: "!kkj",
    execute(message, args) {
        newUserChannel = message.member.voice.channel;
        player.execute(message, "./resources/sounds/kkj.mp3", newUserChannel);
    },
};
