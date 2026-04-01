const fs = require('fs');
const path = require('path');

/**
 * Nexus OS Tool: SkillReader (V2.0 - Elite Edition)
 * Reads specialized Standard Operating Procedures (SOPs) from the Antigravity Awesome Skills library.
 * Now features High-Fidelity Semantic Search and Deep-Level Skill Discovery.
 */
class SkillReader {
    constructor() {
        this.index = null;
        this.libraryRoot = __dirname.replace(/\\tools$/, '').replace(/\/tools$/, ''); // Points to the root of the project
        this.skillsDir = path.join(this.libraryRoot, 'skills');
        this.indexPath = path.join(this.libraryRoot, 'skills_index.json');
    }

    _getValidSkillsDir() {
        if (fs.existsSync(this.skillsDir)) return this.skillsDir;
        // Fallbacks for portability
        const localPrimary = path.join(process.cwd(), '.agent', 'skills');
        if (fs.existsSync(localPrimary)) return localPrimary;
        return null;
    }

    _loadIndex() {
        if (this.index) return this.index;
        if (fs.existsSync(this.indexPath)) {
            try {
                const data = fs.readFileSync(this.indexPath, 'utf8');
                this.index = JSON.parse(data);
                return this.index;
            } catch (err) {
                console.error('Error parsing skills_index.json:', err.message);
            }
        }
        return null;
    }

    /**
     * Lists available skills with metadata.
     */
    listSkills() {
        const index = this._loadIndex();
        if (index) {
            return `Nexus OS has access to ${index.length} elite skills. Use findBestSkill(intent) to pick the right one. 
Categories: ${[...new Set(index.map(s => s.category))].join(', ')}.`;
        }

        const skillsDir = this._getValidSkillsDir();
        if (!skillsDir) return `Error: No skills library found.`;

        try {
            const dirs = fs.readdirSync(skillsDir).filter(f => !f.startsWith('.'));
            return `Found ${dirs.length} skills (Folder Listing Mode). Examples: ${dirs.slice(0, 20).join(', ')}`;
        } catch (err) {
            return `Error listing skills: ${err.message}`;
        }
    }

    /**
     * Reads a specific SKILL.md playbook.
     */
    readSkill(skillName) {
        const cleanName = skillName.replace(/^@/, '').toLowerCase().trim();
        const index = this._loadIndex();
        let relativePath = null;
        let metadata = null;

        if (index) {
            const entry = index.find(s => s.id === cleanName || s.name.toLowerCase() === cleanName);
            if (entry) {
                // Ensure path is relative to the root of the library (e.g. 'skills/marketing/seo-audit')
                // The index path usually includes 'skills/' prefix
                relativePath = entry.path;
                metadata = entry;
            }
        }

        // Fallback to shallow path if not in index or index missing
        const skillsDir = this._getValidSkillsDir();
        const fullPath = relativePath 
            ? path.join(this.libraryRoot, relativePath, 'SKILL.md')
            : path.join(skillsDir, cleanName, 'SKILL.md');

        if (!fs.existsSync(fullPath)) {
            return `Error: Skill '${cleanName}' not found. Path checked: ${fullPath}`;
        }

        try {
            const content = fs.readFileSync(fullPath, 'utf8');
            let report = `[LOADED ELITE SKILL: ${metadata?.name || skillName}]\n`;
            if (metadata) {
                report += `[CATEGORY: ${metadata.category}]\n[RISK: ${metadata.risk}]\n[DESCRIPTION: ${metadata.description}]\n\n`;
            }
            report += content;
            return report + `\n\n[SYSTEM INSTRUCTION: You are now operating as a ${metadata?.category || 'Specialist'}. Strictly follow the SOP above.]`;
        } catch (err) {
            return `Error reading skill: ${err.message}`;
        }
    }

    /**
     * 10x Search Upgrade: Finds the best skills matching user intent using metadata.
     */
    findBestSkill(userIntent) {
        const index = this._loadIndex();
        if (!index) return this.searchSkills(userIntent); // Fallback to basic search

        const query = userIntent.toLowerCase();
        const keywords = query.split(/[\s,.?!]+/).filter(k => k.length > 3);
        const isMarketingIntent = /\b(promote|ads|marketing|campaign|social|meta|facebook|instagram|google ads|linkedin|seo|audit)\b/i.test(query);

        const scored = index.map(skill => {
            let score = 0;
            const id = (skill.id || '').toLowerCase();
            const name = (skill.name || '').toLowerCase();
            const desc = (skill.description || '').toLowerCase();
            const cat = (skill.category || '').toLowerCase();

            // A. Exact ID or Name Match (Highest Priority)
            if (id === query || name === query) score += 50;

            // B. Keyword Matching with Weighting
            keywords.forEach(kw => {
                if (id.includes(kw)) score += 15;
                if (name.includes(kw)) score += 10;
                if (cat.includes(kw)) score += 8;
                if (desc.includes(kw)) score += 3;
            });

            // C. Category Alignment (High Priority for Intent)
            if (isMarketingIntent && (cat.includes('marketing') || cat.includes('ads') || id.includes('marketing'))) {
                score += 25; // Massive boost for category matching intent
            }

            // D. Negative Bias for Mis-Alignment
            // Prevent technical/metadata tools from hijacking marketing intents
            if (isMarketingIntent && (cat.includes('technical') || cat.includes('system') || id.includes('metadata') || id.includes('maintenance'))) {
                score -= 30; // Heavy penalty for unrelated technical skills
            }

            return { id: skill.id, score, name: skill.name, desc: skill.description };
        });

        return scored
            .filter(s => s.score > 10) // Only pick meaningful matches
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(s => `${s.id} (${s.desc.substring(0, 60)}...)`);
    }

    /**
     * Basic Troubleshooting Search (Fallback)
     */
    searchSkills(query) {
        const skillsDir = this._getValidSkillsDir();
        if (!skillsDir) return [];
        try {
            const dirs = fs.readdirSync(skillsDir).filter(f => !f.startsWith('.'));
            const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
            return dirs.filter(s => keywords.some(k => s.toLowerCase().includes(k))).slice(0, 10);
        } catch (err) { return []; }
    }
}

module.exports = new SkillReader();
