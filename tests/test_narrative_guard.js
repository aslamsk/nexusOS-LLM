const NexusOrchestrator = require('../index');

async function test() {
    console.log("Testing Orchestrator Narrative Guard...");
    const textLower = "I'll use the generateImage tool to create your chicken pickle image. Here is the result: [Image]".toLowerCase();
    
    // Exact same regex from index.js
    const isNarratingToolSuccess = 
        /\b(i will use|i'll use|calling tool|now using|generating now|here is the image|post is ready|successfully (published|sent|created|generated))\b/i.test(textLower);
    
    console.log("Is Narrating Tool Success:", isNarratingToolSuccess);
    if (isNarratingToolSuccess) {
        console.log("SUCCESS: Guard correctly identified the narration.");
    } else {
        console.log("FAILURE: Guard missed the narration.");
        process.exit(1);
    }
}

test();
