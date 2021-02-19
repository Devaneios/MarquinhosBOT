module.exports = {
    name: "default",
    description: "Default fallback message",
    usage: "!default",
    hide: true,
    execute(message, args) {
        message.channel.send("Favor digitar um comando válido.");
    },
};
