const logging = require("./../utils/debugger");
const manager = require("./../utils/management").manager
module.exports = {
    name: "debug",
    description: "Ativa o modo debug no chat #debug",
    usage: "!debug <modo>",
    async execute(message, args) {
        if (!args.length) {
            return message.reply("você precisa dizer se quer ligar ou desligar");
        }
        if(["on","ligar","liga","1", "ativar"].includes(args[0]) && !manager.debug){
            manager.debugChannel = await message.guild.channels.create('marquinhos-debug', {topic: "devs", reason: 'Mostra os logs de erro do marquinhos' });
            manager.debugChannel.setParent("776598685718544395");
            manager.debug = true;
            message.channel.send("Modo debug ativado");
        }else if(["off","desligar","desliga","0", "desativar"].includes(args[0]) && manager.debug){
            await manager.debugChannel.delete();
            manager.debug = false;
            message.channel.send("Modo debug desativado");
        }else{
            message.channel.send("Argumento inválido");
        }
    },
};
