const NexusOrchestrator = require('../index');
const fs = require('fs');
const path = require('path');

async function runTest() {
    console.log("🚀 Starting Jarvis Integration Test...");

    // Clean up data for fresh test
    const dataDir = path.join(__dirname, '..', 'data');
    ['projects.json', 'tasks.json', 'artifacts.json'].forEach(f => {
        fs.writeFileSync(path.join(dataDir, f), JSON.stringify([]));
    });

    const orchestrator = new NexusOrchestrator((update) => {
        console.log(`[TELEM] ${update.type.toUpperCase()} | ${update.agentId || 'System'} | ${update.status || ''} | ${update.message || ''}`);
    });

    const goal = "I need a professional research report on autonomous AI agents and a corresponding marketing banner design.";
    
    console.log(`\nGoal: "${goal}"\n`);

    try {
        await orchestrator.execute(`Strategic Objective: ${goal}\n\nPlease use your jarvisExecute tool to plan and execute this goal.`);
        
        console.log("\n✅ Orchestration completed. Checking results...");
        
        const projects = JSON.parse(fs.readFileSync(path.join(dataDir, 'projects.json'), 'utf8'));
        const tasks = JSON.parse(fs.readFileSync(path.join(dataDir, 'tasks.json'), 'utf8'));
        const artifacts = JSON.parse(fs.readFileSync(path.join(dataDir, 'artifacts.json'), 'utf8'));

        console.log(`\nResults:`);
        console.log(`- Projects: ${projects.length}`);
        console.log(`- Tasks: ${tasks.length}`);
        console.log(`- Artifacts: ${artifacts.length}`);

        console.log("\nTasks List:");
        tasks.forEach(t => console.log(`  [${t.role}] ${t.title} - Status: ${t.status}`));

        const hasReport = tasks.some(t => t.role === 'manager' && t.title.includes('Report'));
        if (hasReport) {
            console.log("\n✨ SUCCESS: Automated Manager Report task was spawned!");
        } else {
            console.log("\n⚠️ WARNING: Manager Report task was NOT spawned. Check ExecutionEngine logic.");
        }

    } catch (error) {
        console.error("\n❌ Test Failed:", error);
    }
}

runTest();
