module.exports = {
    name: "encerrar-chamada",
    description: "Eu expulso todo mundo que dormiu na chamada (todos)",
    usage: "!mover-todos <nome do canal>",
    async execute(message) {
        if(message.member.hasPermission('MOVE_MEMBERS')){
            let voiceChannel = message.member.voice.channel;
            if(!voiceChannel){
                await message.channel.send("Mas tu nem tá num canal de voz vei :(");
                return;
            }

            let activeUsers = voiceChannel.members.array();
            for(x = 0; x < activeUsers.length; x++){
                try {
                    activeUsers[x].voice.disconnect();
                } catch (error) {
                    console.log(`Não foi possível desconectar ${activeUsers[x].user.username}.`);
                    continue;
                }
            }
        }
        else{
            await message.channel.send("Esse aqui é só pra admin. Foi mal.");
        }
    }
};