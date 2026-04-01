const NexusOrchestrator = require('../index');
const LLMService = require('../core/llm');

async function testHallucinationTrap() {
    console.log("--- Testing Hallucination Trap ---");
    
    // Mock LLM response that simulates a hallucination
    const mockHallucination = {
        text: "I have successfully generated the image for you. Here it is: [Image: boy_pickle.png]. Task Complete.",
        toolCall: null,
        provider: 'Gemini',
        model: 'gemini-1.5-pro'
    };

    // Override LLMService to return our mock
    const originalGenerate = LLMService.prototype.generateResponse;
    LLMService.prototype.generateResponse = async () => {
        console.log("[Mock LLM] Returning hallucination content...");
        return mockHallucination;
    };

    let trapTriggered = false;

    const orchestrator = new NexusOrchestrator((event) => {
        if (event.type === 'thought') {
            console.log(`[Thought] ${event.message}`);
            if (event.message.includes('Detection') && event.message.includes('Narrated action without tool call')) {
                trapTriggered = true;
                console.log("✅ SUCCESS: Narrative Guard triggered and emitted warning.");
            }
        } else if (event.type === 'complete') {
            console.log(`[Complete] ${event.message}`);
        } else if (event.type === 'error') {
            console.log(`[Error] ${event.message}`);
        }
    });

    try {
        console.log("Starting mission execution...");
        
        // Execute the mission
        const execPromise = orchestrator.execute("Generate an image of a boy.");
        
        // Timeout to stop it after it triggers
        const timeout = setTimeout(() => {
            console.log("[Test] stopping orchestrator...");
            orchestrator.isStopped = true; 
        }, 12000);

        await execPromise;
        clearTimeout(timeout);

        if (trapTriggered) {
            console.log("--- Hallucination Trap Test PASSED ---");
            process.exit(0);
        } else {
            console.error("❌ FAILURE: Narrative Guard failed to trigger.");
            process.exit(1);
        }
    } catch (err) {
        if (trapTriggered) {
            console.log("--- Hallucination Trap Test PASSED (stopped/error but triggered) ---");
            process.exit(0);
        }
        console.error(`[Test Error] ${err.message}`);
        process.exit(1);
    } finally {
        LLMService.prototype.generateResponse = originalGenerate;
    }
}

testHallucinationTrap();
