const SkillGenerator = require('../tools/skillGenerator');
const path = require('path');
const fs = require('fs');

async function test() {
    console.log("Testing Skill Creation...");
    const skillGen = new SkillGenerator(path.join(__dirname, 'data', 'test_skills'));
    
    const skillCode = `
module.exports = {
    main: async (params) => {
        const { a, b } = params;
        return \`The sum of \${a} and \${b} is \${a + b}\`;
    }
};
    `;

    const result = await skillGen.createSkill("Math Helper", skillCode, "Adds two numbers");
    console.log("Creation Result:", result);

    if (result.includes("Success")) {
        console.log("Loading and executing skill...");
        const MathHelper = skillGen.loadSkill("Math Helper");
        const execResult = await MathHelper.main({ a: 5, b: 10 });
        console.log("Execution Result:", execResult);
        
        if (execResult === "The sum of 5 and 10 is 15") {
            console.log("Skill Creation Test PASSED!");
        } else {
            console.log("Skill Execution Test FAILED!");
            process.exit(1);
        }
    } else {
        console.log("Skill Creation Test FAILED!");
        process.exit(1);
    }
}

test();
