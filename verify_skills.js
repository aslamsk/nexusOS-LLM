const fs = require('fs');
const path = require('path');
const reader = require('./tools/skillReader');

const skillsDir = path.join(__dirname, 'skills');

if (!fs.existsSync(skillsDir)) {
    console.error(`ERROR: Skills directory NOT found at ${skillsDir}`);
    process.exit(1);
}

const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
const skillFolders = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));

console.log(`Total Skill Folders Found: ${skillFolders.length}`);

// Random sampling
const sampleSize = 10;
const sampled = [];
for (let i = 0; i < sampleSize; i++) {
    const randomIdx = Math.floor(Math.random() * skillFolders.length);
    sampled.push(skillFolders[randomIdx].name);
}

console.log(`\nVerifying ${sampleSize} random skills:`);
sampled.forEach(skill => {
    const mdPath = path.join(skillsDir, skill, 'SKILL.md');
    const exists = fs.existsSync(mdPath);
    console.log(`- ${skill}: ${exists ? '✅ SKILL.md exists' : '❌ SKILL.md MISSING'}`);
});

console.log(`\nTesting tool output:`);
console.log(reader.listSkills());
