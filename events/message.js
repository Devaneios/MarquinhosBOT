const manager = require('../utils/management').manager;
const utils = require('./../utils/utils');

require('dotenv').config();
module.exports = async (client, message) => {
    if (message.author.bot) return;

    //if (message.content.indexOf(config.prefix) !== 0) return;

    //if (!cmd) return;

    const args = message.content.slice(process.env.PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // This is about messages that is just "!!!"
    if (!commandName) return;

    const command =
        client.commands.get(commandName) ||
        client.commands.find(
            (cmd) => cmd.aliases && cmd.aliases.includes(commandName)
        );
        
    if (message.content.startsWith(process.env.PREFIX)) {
        if(!command){
            message.reply(" esse comando não existe! Digite !help para uma lista de comandos.");
            return;
        }
        try {
            console.log(`Executando ${commandName}`);
            command.execute(message, args, client);
        } catch (error) {
            message.reply("quebrei! :(");
            if(manager.debug){
                manager.debugChannel.send("```"+`${error}`+"```");
            }else{
                console.log(error);
            }
        }
    } else {
        // Bom dia and Parabéns replies
        try {
            const re = new RegExp(/\b(bom dia)\b/gi);
            const re2 = new RegExp(/(^[Pp]arab[ée]ns.*[Mm]arquinhos)/gi);
        
        if (re.test(message.content)) {
            message.delete();
            message_sent = await message.channel.send(`${message.content} é o caralho.`);
            setTimeout(() => {
                message_sent.delete();
            }, 5000);
        } else if(re2.test(message.content)){
            await message.reply("parabéns pra VOCÊ! Você é incrível! :)");
        }
        // Commands out of the proper channel cases
        const channel = message.channel;

        // For bots commands
        if (
            channel.id != process.env.BOT_CHANNEL_ID &&
            message.content.charAt(0).match("[-;>]")
        ) {
            message.author.send(
                "Este não é o canal apropriado para comandos de bots."
            );
            message.delete({timeout: 10000});

            return;
        }
        // For links outside of the links channel
        if (
            channel.id == process.env.LINKS_CHANNEL_ID &&
            !utils.stringIsAValidUrl(message.content)
        ) {
            await message.author.send("Esse canal é para enviar links! >:(");
            message.delete({timeout: 2000});

            return;
        }
        // For the chat-secreto feature
        if(manager.chatSecreto != {}){
            if( manager.chatSecreto.inicio + manager.chatSecreto.duracao > Date.now() ){
                if(manager.chatSecreto.canal == message.channel.id){
                    setTimeout(() => {
                        message.delete();
                    }, 20 * 1000); // That's 20 seconds for proper reading
                }
            }else{
                manager.chatSecreto = {};
            }
        }
        } catch (error) {
            manager.debugChannel.send("```"+`${error}`+"```");
            console.log(error);
        }
        
    }
};
