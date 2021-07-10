const admin = require("firebase-admin");

const serviceAccount = require("../key.json");
const developmentServiceAccount = require("../key-dev.json");

class Database {
	db;
	constructor() {
        if(process.env.MODE == "DEVELOPMENT")
		admin.initializeApp({
			credential: admin.credential.cert(developmentServiceAccount),
		});
        else
        admin.initializeApp({
			credential: admin.credential.cert(serviceAccount),
		});

		this.db = admin.firestore();
		this.FieldValue = admin.firestore.FieldValue;
	}

    async getCollection(collectionName) {
        return this.db.collection(collectionName);
    }

    async getCollectionDocument(collectionName, documentName){
        return this.db.collection(collectionName).doc(documentName);
    }

    async getCollectionSnapshot(collectionName) {
        return await this.db.collection(collectionName).get();
    }

    async getCollectionDocumentSnapshot(collectionName, documentName){
        return await this.db.collection(collectionName).doc(documentName).get();
    }

    async getCollectionDocumentField(guildId, userId, field){
        const document = this.db.collection(guildId).doc(userId);
		const doc = await document.get();
		if (!doc.exists) {
            return null;
		} else {
			return doc.data()[field];
		}
    }

    async getDataOrdered(collection, field, order, size) {
		const users = this.db.collection(collection);
		const orderedData = await users.orderBy(field, order).limit(size).get();
		const response = orderedData.docs.map((doc) => {
			return { id: doc.id, [field]: doc.data()[field] };
		});
		return response;
	}

	async updateCollectionDocumentField(collectionId, documentId, field, value) {
		const snapshot = this.db.collection(collectionId).doc(documentId);
		await snapshot.update({ [field]: value });
	}

    async setCollectionDocumentField(collectionId, documentId, field, value) {
		const snapshot = this.db.collection(collectionId).doc(documentId);
		await snapshot.set({ [field]: value });
	}

    async removeCollectionDocument(collectionId, documentId) {
		await this.db.collection(collectionId).doc(documentId).delete();
	}

    async updateField(collectionDocument, field, value){
        await collectionDocument.update({ [field]: value });
    }

    async setField(collectionDocument, field, value){
        await collectionDocument.set({ [field]: value });
    }
}

module.exports.database = new Database();
