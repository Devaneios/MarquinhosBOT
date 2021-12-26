/* //const admin = require("firebase-admin");

const serviceAccount = require("../key.json");

class Database {
	db;
	constructor() {
		admin.initializeApp({
			credential: admin.credential.cert(serviceAccount),
		});

		this.db = admin.firestore();
		this.FieldValue = admin.firestore.FieldValue;
	}

	async updateServers(client) {
		client.guilds.cache.forEach(this.eachServer.bind(this));
	}

	async eachServer(server) {
		const serverFromFirebase = await this.db.collection(server.id).get();
		let users = await server.members.fetch();
		if (serverFromFirebase.empty) {
			users.forEach(async (user) => {
				if (!user.user.bot) {
					this.addNewUser(server.id, user.id);
				}
			});
		} else {
			const firebaseUsers = serverFromFirebase.docs.map((doc) => doc.id);
			users.forEach(async (user) => {
				if (!firebaseUsers.includes(user.id) && !user.user.bot) {
					this.addNewUser(server.id, user.id);
				}
			});
		}
	}

	async addNewUser(serverId, userId) {
		const users = this.db.collection(serverId).doc(userId);
		await users.set({ preso: false });
		await users.update({ time: 0 });
		await users.update({ coin: 0 });
	}

    async getUserData(guildId, userId, field){
        const userTime = this.db.collection(guildId).doc(userId);
		const doc = await userTime.get();
		if (!doc.exists) {
			await this.addNewUser(guildId, userId);
			const auxDoc = await userTime.get();
            return doc.data()[field];
		} else {
			return doc.data()[field];
		}
    }

    async getDataOrdered(guildId, field, order, size) {
		const users = this.db.collection(guildId);
		const orderedData = await users.orderBy(field, order).limit(size).get();
		const response = orderedData.docs.map((doc) => {
			return { id: doc.id, [field]: doc.data()[field] };
		});
		return response;
	}

	async updateUserData(guildId, userId, field, newValue) {
		const snapshot = this.db.collection(guildId).doc(userId);
		await snapshot.update({ [field]: newValue });
	}
}

module.exports.database = new Database();
 */