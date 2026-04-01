const reader = require('./tools/skillReader');
console.log("Listing skills:");
console.log(reader.listSkills());

console.log("\nReading '@react-patterns':");
const skillContent = reader.readSkill('@react-patterns');
console.log(skillContent.substring(0, 500) + '...');
