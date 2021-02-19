const fileEdit = require("./../utils/fileEdit");
const animalLottery = require("./../utils/animalLottery");
const roleta = require('./../utils/adminRoulette');
require('dotenv').config();
module.exports = (client) => {
    console.log("logged");
    client.user.setActivity(animalLottery.get_bicho());
    //client.user.setAvatar('./resources/images/marquinhosnatal.png');
    //client.user.setAvatar('./resources/images/marquinhoshead.jpg');
    //client.user.setActivity("NADA PORQUE ESTOU EM MODO DEVELOPMENT");
    fileEdit.edit("isReady", true);
    setInterval(function () {
        client.user.setActivity(animalLottery.get_bicho());
    }, 100 * 1000);
    var counter = 0;
    let guild = client.guilds.cache.find((guild) => guild.name === process.env.GUILD_NAME);
    deleteDebugChannelOnStart(guild);
    setInterval(async function () {
        try {
            await roleta.roulette(counter, guild);
        } catch (error) {
            console.log(error)
        }
        counter = (counter + 1)%5;
    }, 6 * 3600000);
    // 6 hours * 1 hour in milliseconds
};

async function deleteDebugChannelOnStart(server){
    let category = await server.channels.cache.find(c => c.name == "devs" && c.type == "category"),
    channel = await server.channels.cache.find(c => c.name == "marquinhos-debug" && c.type == "text");
    if(channel){
        channel.delete();
    }
}
