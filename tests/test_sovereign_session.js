const NexusOrchestrator = require('../index');
const path = require('path');
const fs = require('fs');

async function testSessionIsolation() {
    console.log("--- Testing Session Isolation ---");
    const orchestrator = new NexusOrchestrator();
    
    // Simulate a mission
    orchestrator.context.push({ role: 'user', content: 'Old mission baggage' });
    orchestrator.currentClientId = 'client_123';
    console.log("Context size before reset:", orchestrator.context.length);
    console.log("ClientId before reset:", orchestrator.currentClientId);

    // Reset
    orchestrator.reset();
    console.log("Context size after reset:", orchestrator.context.length);
    console.log("ClientId after reset:", orchestrator.currentClientId);
    console.log("IsStopped after reset:", orchestrator.isStopped);

    if (orchestrator.context.length === 1 && orchestrator.currentClientId === null) {
        console.log("✅ RESET SUCCESSFUL");
    } else {
        console.error("❌ RESET FAILED");
    }
}

async function testProactiveScanner() {
    console.log("--- Testing Proactive Scanner ---");
    const orchestrator = new NexusOrchestrator();
    
    try {
        const result = await orchestrator.dispatchTool({
            name: 'proposeCampaign',
            args: { niche: 'luxury handbags' }
        });
        console.log("Proposal:", result.proposal);
        if (result.proposal && result.proposal.includes('luxury handbags')) {
            console.log("✅ SCANNER SUCCESSFUL");
        } else {
            console.error("❌ SCANNER FAILED");
        }
    } catch (e) {
        console.error("❌ SCANNER ERROR:", e.message);
    }
}

async function runDir() {
    await testSessionIsolation();
    await testProactiveScanner();
}

runDir().catch(console.error);
