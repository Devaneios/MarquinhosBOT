const manager = require("./../utils/management").manager;
module.exports = {
    name: "encarcerados",
    aliases: ["presos"],
    description: "Te dou uma lista de encarcerados",
    usage: "!encarcerados|!presos",
    execute(message, args) {
        lista = "";
        for (x = 0; x < manager.idPreso.length; x++) lista += manager.idPreso[x] + "\n";
        if (lista != "") {
            message.author.send(lista);
        } else {
            message.author.send("Ninguém preso!");
        }
    },
};
