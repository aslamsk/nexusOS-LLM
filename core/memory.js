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

    async saveRecoveryPattern(pattern) {
        if (!db) return "Error: Firebase not initialized.";
        try {
            await db.collection('recovery_patterns').add({
                ...pattern,
                timestamp: new Date()
            });
            return "SUCCESS: Recovery pattern saved.";
        } catch (e) {
            return `Error saving recovery pattern: ${e.message}`;
        }
    }

    async findRecoveryPatterns(query, limit = 5) {
        if (!db) return [];
        try {
            const snapshot = await db.collection('recovery_patterns')
                .orderBy('timestamp', 'desc')
                .limit(25)
                .get();

            const normalizedQuery = String(query || '').toLowerCase();
            const matches = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const haystack = [
                    data?.tool,
                    data?.classification,
                    data?.summary,
                    data?.playbook,
                    data?.resolution
                ].join(' ').toLowerCase();
                if (!normalizedQuery || haystack.includes(normalizedQuery)) {
                    matches.push(data);
                }
            });
            return matches.slice(0, limit);
        } catch (e) {
            console.error('[Memory] Recovery pattern lookup failed:', e.message);
            return [];
        }
    }
}

module.exports = new MemoryService();
