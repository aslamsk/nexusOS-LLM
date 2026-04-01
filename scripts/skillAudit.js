const fs = require('fs');
const path = require('path');

const LIBRARY_ROOT = path.join(__dirname, '..');
const SKILLS_DIR = path.join(LIBRARY_ROOT, 'skills');
const INDEX_PATH = path.join(LIBRARY_ROOT, 'skills_index.json');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

function audit() {
    console.log('--- Nexus OS Elite Skill Audit & Healing ---');
    
    if (!fs.existsSync(INDEX_PATH)) return console.error('Index missing.');
    const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    
    const results = { verified: 0, nonStandard: 0, healed: 0, missing: 0 };
    const missingMd = [];

    index.forEach(skill => {
        const fullSkillPath = path.join(LIBRARY_ROOT, skill.path);
        const mdPath = path.join(fullSkillPath, 'SKILL.md');

        if (!fs.existsSync(fullSkillPath)) {
            results.missing++;
            return;
        }

        if (!fs.existsSync(mdPath)) {
            // SELF-HEALING: Create basic SKILL.md from index
            const template = `# ${skill.name}\n\n${skill.description}\n\n## SOP\n1. [SYSTEM: This skill was autonomously healed. Please populate with specific SOPs.]\n\n## Diamond Standard\n- Verified: false\n`;
            fs.writeFileSync(mdPath, template);
            results.healed++;
        } else {
            const content = fs.readFileSync(mdPath, 'utf8');
            if (content.includes('# SOP') && content.includes('Diamond Standard')) {
                results.verified++;
            } else {
                results.nonStandard++;
            }
        }
    });

    console.log(`\nResults:\n- Verified: ${results.verified}\n- Non-Standard: ${results.nonStandard}\n- Healed (Created): ${results.healed}\n- Missing on Disk: ${results.missing}`);
}

audit();

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });

  return arrayOfFiles;
}

function getAllDirs(dirPath, arrayOfDirs) {
  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  arrayOfDirs = arrayOfDirs || [];

  files.forEach(function(file) {
    if (file.isDirectory()) {
      const fullPath = path.join(dirPath, file.name);
      arrayOfDirs.push(fullPath);
      arrayOfDirs = getAllDirs(fullPath, arrayOfDirs);
    }
  });

  return arrayOfDirs;
}

audit();
