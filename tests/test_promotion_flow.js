const NexusOrchestrator = require('../index');
const path = require('path');

async function testPromotionFlow() {
    console.log("🚀 Testing Nexus OS Promotion Flow (Chicken Pickle)...");
    
    // Set a task directory for outputs
    const taskDir = path.join(__dirname, 'outputs', 'promotion_test');
    if (!require('fs').existsSync(taskDir)) require('fs').mkdirSync(taskDir, { recursive: true });
    
    const orchestrator = new NexusOrchestrator(null, taskDir);
    
    const userRequest = "ii need one image for chicken pickle with a 12-year-old boy enjoying it. He's tasting it for the first time and looks surprised by the amazing taste. It's an indoor kitchen setting.";
    
    console.log(`User: ${userRequest}`);
    
    // We'll run the execution loop. 
    // Since this involves image generation which might be slow or hit 429s, we'll just verify it TRIGGERS the tool.
    await orchestrator.execute(userRequest);
    
    console.log("\n✅ Test finished. Check the logs above to ensure 'generateImage' was actually called (not just narrated).");
}

testPromotionFlow().catch(err => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});
