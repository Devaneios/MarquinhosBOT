const movieTheaterService = require("../services/movieTheaterService").movieTheaterService;

module.exports = {
    name: "criar-sessao",
    description: "Envia instruções de como criar uma sessão de cinema",
    usage: "!criar-sessao",
    async execute(message, args) {
        let sessionId = await movieTheaterService.startCreateSession(message.author.id);
        console.log(`Sessão criada com id ${sessionId}`);
        let movie = await movieTheaterService.setupSessionMovie(sessionId, "Sharknado", "WARGWARGFUUU", "a.jpg");
        console.log(`Filme adicionado a sessão ${sessionId}`);
        console.log(movie);
        let date = await movieTheaterService.setupSessionDateTime(sessionId, "00000");
        console.log(`Data e horário adicionado a sessão ${sessionId}`);
        console.log(date);
        console.log(await movieTheaterService.getMovieSession(sessionId));
        await movieTheaterService.cancelCreateSession(sessionId);
        console.log(await movieTheaterService.getMovieSession(sessionId));

    },
};