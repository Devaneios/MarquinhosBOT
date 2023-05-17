const admin = require("firebase-admin");

const serviceAccount = require("../key.json");
const developmentServiceAccount = require("../key-dev.json");

class Firebase {

	constructor() {
        this.initializeFirebase();
		this.firestore = admin.firestore();
		this.FieldValue = admin.firestore.FieldValue;
	}

    initializeFirebase() {
        if(process.env.MODE == "DEVELOPMENT")
		admin.initializeApp({
			credential: admin.credential.cert(developmentServiceAccount),
		});
        else
        admin.initializeApp({
			credential: admin.credential.cert(serviceAccount),
		});
    }
}

module.exports.firestore = new Firebase().firestore;