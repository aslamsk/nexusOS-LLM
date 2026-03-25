const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

/**
 * Firebase Subsystem Initialization
 */
let db;

try {
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
    const inlineServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
    if (inlineServiceAccount) {
        const serviceAccount = JSON.parse(inlineServiceAccount);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        db = admin.firestore();
        console.log("[Firebase] Successfully initialized Firestore from inline service account JSON.");
    } else {
        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            db = admin.firestore();
            console.log("[Firebase] Successfully initialized Firestore from service account file.");
        } else {
            try {
                admin.initializeApp({
                    credential: admin.credential.applicationDefault()
                });
                db = admin.firestore();
                console.log("[Firebase] Successfully initialized Firestore using application default credentials.");
            } catch (defaultError) {
                console.warn("[Firebase] No service account file found and application default credentials are unavailable. Firestore features will be disabled.");
            }
        }
    }
} catch (error) {
    console.error("[Firebase] Initialization failed:", error.message);
}

module.exports = { admin, db };
