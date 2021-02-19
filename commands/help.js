require('dotenv').config();
const { prefix } = process.env.PREFIX;
const Discord = require("discord.js");
module.exports = {
    name: "help",
    description: "Eu te ajudo, dã.",
    aliases: ["commands"],
    usage: "!help <nome do comando>",
    cooldown: 5,
    async execute(message, args) {
        const data = [];
        const { commands } = message.client;

        if (!args.length) {
            let fields = commands.filter((cmd) => !cmd.hide).map((command) => {
                const container = {};

                container.name = command.name;
                container.value = command.description;

                return container;
            });
            // data.push(commands.map((command) => command.name).join(", "));
            // data.push(
            //     `\nYou can send \`${prefix}help [command name]\` to get info on a specific command!`
            // );
            var amount = 5
            var start = 0;
            var end = amount;
            const helpEmbed = new Discord.MessageEmbed()
                .setColor("#0099ff")
                .setTitle("Commands")
                .setDescription("Eu faço isso aqui ó:")
                .addFields(fields.slice(start, end));

            let helpEmbedRef = await message.channel.send(helpEmbed);
            await helpEmbedRef.react("⬅");
            await helpEmbedRef.react("➡");

            const reactionCollector = new Discord.ReactionCollector(
                helpEmbedRef,
                (newReaction, user) =>
                    !user.bot &&
                    user.id === message.author.id &&
                    (newReaction.emoji.name === "⬅" ||
                        newReaction.emoji.name === "➡"),
                { time: 60000 }
            );
    
            reactionCollector.on("collect", async (newReaction, user) => {
                newReaction.users.remove(user.id);
                if (newReaction.emoji.name === "⬅" && start <= 0) {
                    start -= amount;
                    end -= amount;
                    helpEmbed.addFields(fields.slice(start, end));
                    helpEmbed.spliceFields(0, amount);

                    helpEmbedRef.edit(helpEmbed);
                } else if (newReaction.emoji.name === "➡" && end <= fields.length) {
                    start += amount;
                    end += amount;
                    helpEmbed.addFields(fields.slice(start, end));
                    helpEmbed.spliceFields(0, amount);
                    helpEmbedRef.edit(helpEmbed);
                }
            });
    
            reactionCollector.on("end", async (newReaction, user) => {
                message.delete();
                helpEmbedRef.delete();
            });

            return;
        }
        const name = args[0].toLowerCase();
        const command =
            commands.get(name) ||
            commands.find((c) => c.aliases && c.aliases.includes(name));

        if (!command) {
            return message.reply("that's not a valid command!");
        }
        let fields = [];
        try{
            if(command.aliases){
                fields.push({"name":"Aliases" , "value":command.aliases});
            }
            if(command.usage){
                fields.push({"name":"Usage", "value":`${command.usage}`});
            }
        }catch(e){
            console.log(e);
        }
        
        
        const exampleEmbed = new Discord.MessageEmbed()
            .setColor("#0099ff")
            .setTitle(command.name)
            .setDescription(`Descrição: ${command.description}`)
            .addFields(fields);

        message.channel.send(exampleEmbed);
    },
};
