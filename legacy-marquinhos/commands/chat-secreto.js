const manager = require('../utils/management').manager;

module.exports = {
    name: "chat-secreto",
    description: "Eu ligo o modo auto-destruição por um tempo determinado. Secreto. :O",
    usage: "!chat-secreto <duração em minutos>",
    async execute(message, args) {

        message.delete();

        // Anti-troll (Guilh*rm*) parse
        const parsed = Number.parseInt(args[0], 10);
        
        if (Number.isNaN(parsed) || (parsed <= 0) || (parsed > 10)) {
            message.channel.send('E isso é tempo útil, bixo (entre 1 e 10 minutos, né...)')
            .then(msg => {msg.delete({ timeout: 10000})}); // It deletes the message after 10 seconds, to keep it secret :x;
            return;
        }
        
        
        if(manager.chatSecreto.canal != undefined){
            message.channel.send(`Já tá ligado vei, ${
                manager.chatSecreto.canal == message.channel ? 
                'aqui nesse canal mesmo, fala teus podre aí' : `lá no ${manager.chatSecreto.canal}. Fala teus podre lá.`
            }`)
            .then(msg => {msg.delete({ timeout: 10000})}); // It deletes the message, again, to keep it secret
            return;
        }

        let ligado_msg = await message.channel.send(`Ok, liguei o modo secreto por ${parsed} ${parsed=='1' ? 'minuto' : 'minutos'}`);

        manager.chatSecreto.canal = message.channel;
        manager.chatSecreto.inicio = Date.now();
        manager.chatSecreto.duracao = args[0] * 60 * 1000;

        setTimeout(async () => {
            message.channel.send('Tô desligando o chat-secreto em 10 segundos, viu')
            .then(msg => {msg.delete({ timeout: 10000})});
        }, (parsed * 60 * 1000) - 10000); // It sends a warning 10 seconds before it deactivates itself
        

        setTimeout(() => {
            ligado_msg.delete();
            manager.chatSecreto = {};
        }, (parsed * 60 * 1000)); // At last, the feature deactivates itself, and deletes the turn on message, of course
    },
};
