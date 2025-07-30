const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json"); // path to your JSON key

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

module.exports = admin;