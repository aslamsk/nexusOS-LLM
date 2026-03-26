const { db } = require('./firebase');

/**
 * Nexus OS: Long-Term Memory Service
 * Persists key facts and learned information across sessions in Firestore.
 */
class MemoryService {
    _normalizeContent(content) {
        if (content === null || content === undefined) return '';
        return typeof content === 'string' ? content : JSON.stringify(content);
    }

    _sanitizeContent(content, category = 'general') {
        const normalized = this._normalizeContent(content).trim();
        if (!normalized) return { skip: true, reason: 'empty' };

        const categoryValue = String(category || '').toLowerCase();
        const likelyEphemeralPayload =
            normalized.length > 4000 ||
            /"boss_approved"\s*:/.test(normalized) ||
            /"media_url"\s*:/.test(normalized) ||
            /"call_to_action"\s*:/.test(normalized) ||
            /agency-quote-\d+/i.test(normalized) ||
            /download pdf quote|download csv quote|download markdown quote/i.test(normalized);

        if (categoryValue === 'decision_log' && normalized.length > 500) {
            return { skip: true, reason: 'decision_log_too_large' };
        }
        if (likelyEphemeralPayload) {
            return { skip: true, reason: 'ephemeral_payload' };
        }
        if (/^error: /i.test(normalized) && normalized.length > 500) {
            return { skip: true, reason: 'raw_error_blob' };
        }

        return { skip: false, content: normalized.slice(0, 2000) };
    }

    /**
     * Store a fact or piece of information.
     */
    async saveMemory(content, category = 'general') {
        const prepared = this._sanitizeContent(content, category);
        const preview = this._normalizeContent(content).slice(0, 50);
        console.log(`[Memory] Saving memory: "${preview}..." [${category}]`);
        if (!db) return "Error: Firebase not initialized.";
        if (prepared.skip) return `SKIPPED: Memory not persisted (${prepared.reason}).`;

        try {
            await db.collection('memories').add({
                content: prepared.content,
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
                const content = String(data.content || '');
                if (content.toLowerCase().includes(query.toLowerCase())) {
                    memories.push(content);
                }
            });
            return memories.length > 0 ? memories.slice(0, 10).join('\n---\n') : "No relevant memories found.";
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
