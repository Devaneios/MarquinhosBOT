module.exports = {
    name: "dm",
    description: "Te envio uma mensagem ;D",
    usage: "!dm",
    execute(message, args) {
        console.log("Sending dm to " + message.author.username);
        message.author.send("Dale menó");
    },
};
