const { nanoid } = require('nanoid');

class movieTheaterService {
	constructor() {
		this.creatingSessionUsers = {};
		this.sessions = {};
	}

	async startCreateSession(userId) {
        let sessionId = nanoid(13);
        if(!this.creatingSessionUsers[sessionId]){
            this.creatingSessionUsers[sessionId] = {"createdBy": userId, "invited":[userId]};
            return sessionId;
        }
        return null;
	}

    async getMovieSession(sessionId){
        return this.creatingSessionUsers[sessionId];
    }

	async cancelCreateSession(sessionId) {
		this.creatingSessionUsers[sessionId] = null;
	}

	async setupSessionMovie(
		sessionId,
		movieName,
		movieDescription,
		movieThumbnail
	) {
		if (this.creatingSessionUsers[sessionId]) {
			this.creatingSessionUsers[sessionId]["movie"] = {
				name: movieName,
				description: movieDescription,
				thumbnail: movieThumbnail,
			};
            return this.creatingSessionUsers[sessionId]["movie"];
		}
        return null;
	}

    async setupSessionDateTime(sessionId, datetime){
        if (this.creatingSessionUsers[sessionId]) {
			this.creatingSessionUsers[sessionId]["datetime"] = datetime;
            return this.creatingSessionUsers[sessionId]["datetime"];
		}
        return null;
    }

    async addUserToSession(sessionId, userId){
        if (this.creatingSessionUsers[sessionId] && !this.creatingSessionUsers[sessionId]["invited"].includes(userId)) {
            this.creatingSessionUsers[sessionId]["invited"].push(userId);
            return userId;
        }
        return null;
    }

    async removeUserFromSession(sessionId, userId){
        if (this.creatingSessionUsers[sessionId] && this.creatingSessionUsers[sessionId]["invited"].includes(userId)) {
            let index = this.creatingSessionUsers[sessionId]["invited"].findIndex(userId);
            this.creatingSessionUsers[sessionId]["invited"].splice(index);
            return userId;
        }
        return null;
    }
}

module.exports.movieTheaterService = new movieTheaterService();