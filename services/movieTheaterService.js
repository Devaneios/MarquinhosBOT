const { nanoid } = require('nanoid');
const moment = require('moment');
const MovieSessionRepository = require("../repositories/movieSessionRepository");
class MovieTheaterService {
	constructor() {
        this.repositories = {};
		this.movieSessions = [];
	}

    async getRepositoryReference(serverId) {
        if (!this.repositories[serverId]) {
            this.repositories[serverId] = new MovieSessionRepository(serverId);
        }
        return this.repositories[serverId];
    }

    async loadMovieSessionsFromDB(serverId, date) {
        let repository = await this.getRepositoryReference(serverId);
        let movieSessions = await repository.getMovieSessionsAfter(date);
        this.movieSessions = this.movieSessions.concat(movieSessions);
    }

	async getNewSessionId() {
        return nanoid(13);
	}

    async saveSession(serverId, session){
        let repository = await this.getRepositoryReference(serverId);
        this.movieSessions.push(session);
        await repository.createMovieSession(session);
    }

    async getMovieSessions() {
        return await this.db.getMovieSessions();
    }

    async getStartingSessions(){
        let startingSessions = [];
        let now = moment();
        for (const session of this.movieSessions) {
            let currentTime = now.toDate().toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
                timeZone: "America/Recife",
            });

            let sessionTenMinutesBefore = new Date(session.date.toDate() - 600000).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
                timeZone: "America/Recife",
            });

            if (currentTime == sessionTenMinutesBefore){
                startingSessions.push(session);
            }
        }
        return startingSessions;
    }
}

module.exports.movieTheaterService = new MovieTheaterService();