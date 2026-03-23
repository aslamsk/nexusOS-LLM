const { db } = require('./core/firebase');

async function wipeCorruptedKeys() {
    try {
        console.log("Connecting to Firestore to purge corrupted keys...");
        if (!db) {
            console.log("No DB connection.");
            return;
        }
        await db.collection('configs').doc('default').delete();
        console.log("Corrupted config document successfully purged. System will now fallback to .env securely.");
        process.exit(0);
    } catch(e) {
        console.error("Error purging:", e);
        process.exit(1);
    }
}
wipeCorruptedKeys();
