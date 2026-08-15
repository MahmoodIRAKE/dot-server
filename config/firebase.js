const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('❌ Missing FIREBASE_SERVICE_ACCOUNT in .env');
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    (serviceAccount.project_id ? `${serviceAccount.project_id}.firebasestorage.app` : undefined);

if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount),
        ...(storageBucket ? { storageBucket } : {})
    });
}

/**
 * Compatibility facade for the old firebase-admin namespaced API
 * (admin.auth().createUser / deleteUser) used across the codebase.
 * firebase-admin v14 removed admin.apps / admin.credential from the default export.
 */
const admin = {
    auth: () => getAuth(),
    storage: () => getStorage(),
    apps: getApps(),
};

module.exports = admin;
