const { firestore } = require("./database");

class MovieSessionRepository{
    constructor(serverId){
        this.movieSessionRef = firestore.collection("servers").doc(serverId).collection("movieSessions");
    }

    async getMovieSessions(){
        const movieSessions = await this.movieSessionRef.get();
        return movieSessions.docs;
    }

    async getMovieSessionsAfter(date){
        const movieSessions = await this.movieSessionRef.where("date", ">", date).get();
        return movieSessions.docs.map(movieSession => movieSession.data());
    }

    async getMovieSession(movieSessionId){
        const movieSession = await this.movieSessionRef.doc(movieSessionId).get();
        return movieSession.data();
    }

    async createMovieSession(movieSession){
        const movieSessionRef = this.movieSessionRef.doc(movieSession.id);
        await movieSessionRef.set(movieSession);
    }

    async updateMovieSession(movieSession){
        const movieSessionRef = this.movieSessionRef.doc(movieSession.id);
        await movieSessionRef.update(movieSession);
    }

    async deleteMovieSession(movieSessionId){
        const movieSessionRef = this.movieSessionRef.doc(movieSessionId);
        await movieSessionRef.delete();
    }

    async getMovieSessionByChannelIdAndMessageId(channelId, messageId){
        const movieSessionRef = this.movieSessionRef.where("messageId", "==", messageId).where("channelId", "==", channelId);
        const movieSession = await movieSessionRef.get();
        return movieSession.docs.map(movieSession => movieSession.data());
    }
}

module.exports = MovieSessionRepository;