const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * Nexus OS: Autonomous Skill Generator
 * Allows the system to write, test, and register its own JavaScript utility skills.
 */
class SkillGenerator {
    constructor(skillsDir = null) {
        this.skillsDir = skillsDir || path.join(process.cwd(), 'data', 'skills');
        if (!fs.existsSync(this.skillsDir)) {
            fs.mkdirSync(this.skillsDir, { recursive: true });
        }
    }

    /**
     * Generates a new skill (JS file) from code provided by the LLM.
     * Includes a syntax check before saving.
     */
    async createSkill(name, code, description) {
        const fileName = `${name.replace(/\s+/g, '_').toLowerCase()}.js`;
        const filePath = path.join(this.skillsDir, fileName);

        console.log(`[SkillGen] Creating new skill: ${name} at ${filePath}`);

        try {
            // Write to a temporary file for syntax checking
            const tempPath = path.join(this.skillsDir, `temp_${Date.now()}.js`);
            fs.writeFileSync(tempPath, code);

            // Basic syntax check using node's check flag
            const check = spawnSync('node', ['-c', tempPath]);
            if (check.status !== 0) {
                const error = check.stderr.toString();
                fs.unlinkSync(tempPath);
                return `Error: Skill syntax check failed. \n${error}`;
            }

            // Move to final location
            fs.renameSync(tempPath, filePath);

            // Save metadata
            const metadataPath = path.join(this.skillsDir, 'skills_manifest.json');
            let manifest = {};
            if (fs.existsSync(metadataPath)) {
                manifest = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            }
            manifest[name] = {
                path: filePath,
                description: description,
                created: new Date().toISOString()
            };
            fs.writeFileSync(metadataPath, JSON.stringify(manifest, null, 2));

            return `Success: New skill '${name}' created and registered. Path: ${filePath}`;
        } catch (error) {
            console.error("[SkillGen Error]", error);
            return `Error creating skill: ${error.message}`;
        }
    }

    /**
     * Lists all autonomously generated skills.
     */
    async listSkills() {
        const metadataPath = path.join(this.skillsDir, 'skills_manifest.json');
        if (!fs.existsSync(metadataPath)) return "No autonomous skills registered yet.";
        
        const manifest = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        return Object.entries(manifest).map(([n, d]) => `- ${n}: ${d.description}`).join('\n');
    }

    /**
     * Helper to load a skill by name.
     */
    loadSkill(name) {
        const metadataPath = path.join(this.skillsDir, 'skills_manifest.json');
        if (!fs.existsSync(metadataPath)) return null;

        const manifest = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        const skill = manifest[name];
        if (!skill) return null;

        return require(skill.path);
    }
}

module.exports = SkillGenerator;
