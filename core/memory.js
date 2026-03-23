const { db } = require('./firebase');

/**
 * Nexus OS: Long-Term Memory Service
 * Persists key facts and learned information across sessions in Firestore.
 */
class MemoryService {
    /**
     * Store a fact or piece of information.
     */
    async saveMemory(content, category = 'general') {
        console.log(`[Memory] Saving memory: "${content.substring(0, 50)}..." [${category}]`);
        if (!db) return "Error: Firebase not initialized.";

        try {
            await db.collection('memories').add({
                content,
                category,
                timestamp: new Date(),
                importance: 1
            });
            return "SUCCESS: Fact remembered for future sessions.";
        } catch (e) {
            return `Error saving memory: ${e.message}`;
        }
    }

    /**
     * Search for relevant memories based on keywords.
     */
    async searchMemory(query) {
        console.log(`[Memory] Searching for: "${query}"`);
        if (!db) return "Error: Firebase not initialized.";

        try {
            const snapshot = await db.collection('memories').get();
            const memories = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.content.toLowerCase().includes(query.toLowerCase())) {
                    memories.push(data.content);
                }
            });
            return memories.length > 0 ? memories.join('\n---\n') : "No relevant memories found.";
        } catch (e) {
            return `Error searching memory: ${e.message}`;
        }
    }

    /**
     * Recall the most recent N memories.
     */
    async recallRecent(limit = 10) {
        if (!db) return [];
        try {
            const snapshot = await db.collection('memories')
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            const results = [];
            snapshot.forEach(doc => results.push(doc.data().content));
            return results;
        } catch (e) {
            console.error('[Memory] Recall failed:', e.message);
            return [];
        }
    }
}

module.exports = new MemoryService();
