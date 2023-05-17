const player = require("./../utils/player");
module.exports = {
    name: "parabens",
    description: "Toca parabéns",
    usage: "!parabens",
    execute(message, args) {
        newUserChannel = message.member.voice.channel;
        player.execute(message, "./resources/sounds/parabens.mp3", newUserChannel);
    },
};
