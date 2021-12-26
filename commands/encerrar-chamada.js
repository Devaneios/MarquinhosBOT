module.exports = {
    name: "encerrar-chamada",
    description: "Eu desconecto todo mundo que dormiu na chamada (ou todos. sei lá.)",
    usage: "!encerrar-chamada",
    async execute(message) {
        if(message.member.hasPermission('MOVE_MEMBERS')){
            const voiceChannel = message.member.voice.channel;
            if(!voiceChannel){
                await message.channel.send("Mas tu nem tá num canal de voz vei :(");
                return;
            }

            const activeUsers = voiceChannel.members.array();
            for(const u of activeUsers){
                try {
                    u.voice.disconnect();
                } catch (error) {
                    console.log(`Não foi possível desconectar ${u.user.username}.`);
                    continue;
                }
            }
        }
        else{
            await message.channel.send("Esse aqui é só pra admin. Foi mal.");
        }
    }
};