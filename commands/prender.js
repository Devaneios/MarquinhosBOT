const fileEdit = require("./../utils/fileEdit");
module.exports = {
    name: "prender",
    description:
        "Prendo alguém da sua escolha, impedindo que essa pessoa volte até que alguém o desprenda.",
    execute(message, args) {
        // idPreso can be undefined (wich will activate the function)
        /* Transforms the content of the message in an array and excludes the !prender part
    arrayPreso = message.content.split(' ');
    arrayPreso.shift();
    // Retransforms the name in a String without the !prender part (why didn't I just used replace()?)
    nomePreso = arrayPreso.join(' ');
    */
        // Get the person who should be arrested
        nomePreso = args[0];
        // Try to find a user with a nickname equals to the given name, and put into the collection presoCollection
        presoCollection = message.guild.members.filter(
            (user) => user.nickname === nomePreso
        );
        // If we don't find the nickname user, try with his real username
        if (presoCollection.array().length != 1) {
            presoCollection = message.guild.members.filter(
                (user) => user.user.username === nomePreso
            );
        }
        idPreso = fileEdit.read("idPreso");
        preso = presoCollection.first();
        if (preso.user.username == "MarquinhosBOT") {
            idPreso.push(message.author.id);
            fileEdit.edit("idPreso", idPreso);
            message.channel.send("Trouxa, eu sou filho do Rei :P");
            return;
        }
        if (!preso) {
            message.channel.send("Não pude achar essa pessoa no servidor!");
        } else {
            if (!idPreso.includes(preso.id)) {
                // Then the id its assigned for the person who'll be arrested
                idPreso.push(preso.id);
                fileEdit.edit("idPreso", idPreso);
                // Here we warn to the sent message's channel that the person will be arrested
                message.channel.send(
                    message.author.username +
                        " prendeu " +
                        preso.user.username +
                        "!"
                );
                // Move the arrested person to the 'alone' channel
                preso.setVoiceChannel("597641313180975174");
            } else {
                message.channel.send(preso.user.username + " já está preso!");
            }
        }
    },
};