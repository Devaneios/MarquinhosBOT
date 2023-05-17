module.exports = {
    name: "cavalo",
    description: "CAVALO?",
    usage: "!cavalo",
    execute(message, args) {
        message.channel.send({ files: ["./resources/animations/cavalo.gif"] });
    },
};
