const { firestore } = require("./database");

class DiscordUserRepository {
    constructor(serverId) {
        this.userRef = firestore.collection("servers").doc(serverId).collection("users");
    }

    async addDiscordUser(user) {
        await this.userRef.doc(user.id).set(user);
    }

    async getDiscordUser(userId) {
        return await this.userRef.doc(userId).get();
    }

    async getDiscordUsers() {
        return await this.userRef.get();
    }

    async updateDiscordUser(user) {
        await this.userRef.doc(user.id).update(user);
    }

    async deleteDiscordUser(userId) {
        await this.userRef.doc(userId).delete();
    }
}

module.exports = DiscordUserRepository;