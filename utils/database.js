const admin = require("firebase-admin");

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

	async getUserTime(guildId, userId) {
		const userTime = this.db.collection(guildId).doc(userId);
		const doc = await userTime.get();
		if (!doc.exists) {
			console.log("No such document!");
			return -1;
		} else {
			return doc.data().time;
		}
	}

	async getTopTime(guildId) {
		const users = this.db.collection(guildId);
		const topTime = await users.orderBy("time", "desc").limit(10).get();
		const response = topTime.docs.map((doc) => {
			return { id: doc.id, time: doc.data().time };
		});
		return response;
	}

	async updateUserTime(guildId, userId, userCurrentTime) {
		const timers = this.db.collection(guildId).doc(userId);
		await timers.update({ time: userCurrentTime });
	}

	async getUsersTime(guildId) {
		const guildTimers = this.db.collection(guildId);
		const usersTime = await guildTimers.get();
		return usersTime.docs();
	}
}

module.exports.database = new Database();
