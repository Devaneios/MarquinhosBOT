module.exports = {
    name: "olavac",
    description: "!oirártnoC",
    usage: "!olavac",
    execute(message, args) {
        message.channel.send({files: ["./resources/animations/olavac.gif"]});
    },
};
