const manager = require('../utils/management').manager;
const tmdbService = require("../services/tmdbService").tmdbService;

module.exports = {
    name: "default",
    description: "Default fallback message",
    usage: "!default",
    hide: true,
    async execute(message, args) {
        try {
            let searchResult = await tmdbService.searchMovie("lalaland");
            console.log(searchResult);
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
