const manage = require('../utils/management').manage;

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
            if(manage.debug){
                manage.debugChannel.send("```"+`${error.message}\n${error.stack}`+"```");
            }else{
                console.log(error);
            }
        }
    },
};
