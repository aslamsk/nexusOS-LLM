const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

/**
 * Firebase Subsystem Initialization
 */
let db;

try {
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
    if (!fs.existsSync(serviceAccountPath)) {
        console.warn("[Firebase] Service account file not found. Firestore features will be disabled.");
    } else {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        db = admin.firestore();
        console.log("[Firebase] Successfully initialized Firestore.");
    }
} catch (error) {
    console.error("[Firebase] Initialization failed:", error.message);
}

module.exports = { admin, db };
