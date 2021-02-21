const logging = require("./../utils/debugger");
const manage = require("./../utils/management").manage
module.exports = {
    name: "debug",
    description: "Ativa o modo debug no chat #debug",
    usage: "!debug <modo>",
    async execute(message, args) {
        if (!args.length) {
            return message.reply("você precisa dizer se quer ligar ou desligar");
        }
        if(["on","ligar","liga","1", "ativar"].includes(args[0]) && !manage.debug){
            manage.debugChannel = await message.guild.channels.create('marquinhos-debug', {topic: "devs", reason: 'Mostra os logs de erro do marquinhos' });
            manage.debugChannel.setParent("776598685718544395");
            manage.debug = true;
            message.channel.send("Modo debug ativado");
        }else if(["off","desligar","desliga","0", "desativar"].includes(args[0]) && manage.debug){
            await manage.debugChannel.delete();
            manage.debug = false;
            message.channel.send("Modo debug desativado");
        }else{
            message.channel.send("Argumento inválido");
        }
    },
};
