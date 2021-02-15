const manage = require('../utils/management').manage;

module.exports = {
    name: "chat-secreto",
    description: "Eu ligo o modo auto-destruição por um tempo determinado. Secreto. :O",
    usage: "!chat-secreto <duração em minutos>",
    async execute(message, args) {


        // Anti-troll (Guilh*rm*) parse
        const parsed = Number.parseInt(args[0], 10);
        
        if (Number.isNaN(parsed) || (parsed <= 0) || (parsed > 10)) {
            message.channel.send('E isso é tempo útil, bixo (entre 1 e 10 minutos, né...)');
            return;
        }
        
        message.delete();
        
        if(manage.chatSecreto.canal != undefined){
            message.channel.send(`Já tá ligado vei, ${
                manage.chatSecreto.canal == message.channel ? 
                'aqui nesse canal mesmo, fala teus podre aí' : `lá no ${manage.chatSecreto.canal}. Fala teus podre lá.`
            }`)
            .then(msg => {msg.delete({ timeout: 10000})}); // It deletes the message after 10 seconds, to keep it secret :x
            return;
        }

        let ligado_msg = await message.channel.send(`Ok, liguei o modo secreto por ${parsed} ${parsed=='1' ? 'minuto' : 'minutos'}`);

        manage.chatSecreto.canal = message.channel;
        manage.chatSecreto.inicio = Date.now();
        manage.chatSecreto.duracao = args[0] * 60 * 1000;

        setTimeout(async () => {
            message.channel.send('Tô desligando o chat-secreto em 10 segundos, viu')
            .then(msg => {msg.delete({ timeout: 10000})});
        }, (args[0] * 60 * 1000) - 10000); // It sends a warning 10 seconds before it deactivates itself
        

        setTimeout(() => {
            ligado_msg.delete();
        }, (args[0] * 60 * 1000)); // After the deactivation, deletes the turn on warning itself
    },
};
