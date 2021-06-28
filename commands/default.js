const manager = require('../utils/management').manager;

module.exports = {
    name: "default",
    description: "Default fallback message",
    usage: "!default",
    hide: true,
    async execute(message, args) {
        try {
            teste.teste;
            message.channel.send("Favor digitar um comando válido.");
        } catch (error) {
            message.reply("quebrei! :(");
            if(manager.debug){
                manager.debugChannel.send("```"+`${error.message}\n${error.stack}`+"```");
            }else{
                console.log(error);
            }
        }
    },
};
