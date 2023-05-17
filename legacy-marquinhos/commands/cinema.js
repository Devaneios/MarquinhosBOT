module.exports = {
    name: "cineminha",
    description: "Envia instruções de como criar uma sessão de cinema",
    usage: "!cineminha",
    execute(message, args) {
        message.author.send(`Oii, quer criar uma nova sessão de cinema? Use o comando ${process.env.PREFIX}criar-sessao para continuar`);
    },
};