const { firestore } = require("./database");

class DiscordServerRepository {
    constructor() {
        this.serverRef = firestore.collection("servers");
    }

    async addDiscordServer(server) {
        await this.serverRef.doc(server.id).set(server);
        return server.id;
    }

    async getDiscordServer(serverId) {
        const server = await this.serverRef.doc(serverId).get();
        return server.data();
    }

    async getDiscordServerList() {
        const serverList = await this.serverRef.get();
        return serverList.map(server => server.data());
    }

    async deleteDiscordServer(serverId) {
        await this.serverRef.doc(serverId).delete();
    }

    async updateDiscordServer(server) {
        await this.serverRef.doc(server.id).update(server);
    }
}

module.exports = DiscordServerRepository;