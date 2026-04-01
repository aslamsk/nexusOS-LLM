const assert = require('assert');
const NexusOrchestrator = require('../index');
const MissionMode = require('../core/missionMode');

function testMissionModeRouting() {
    console.log('--- Testing Mission Mode Routing ---');
    const planMode = MissionMode.detectMissionMode('analyze this landing page and tell me what is wrong');
    const executeMode = MissionMode.detectMissionMode('create a banner for my ad campaign');

    assert.strictEqual(planMode, 'plan', 'Ambiguous analysis requests should prefer PLAN mode');
    assert.strictEqual(executeMode, 'execute', 'Concrete creation requests should prefer EXECUTE mode');
    console.log('PASS mission mode routing');
}

function testTaskContract() {
    console.log('--- Testing Task Contract ---');
    const orchestrator = new NexusOrchestrator();
    const contract = orchestrator._buildTaskContract('create a quote for Acme for monthly marketing services');

    assert.ok(contract);
    assert.ok(String(contract.expectedDeliverable).includes('quote'));
    assert.ok(Array.isArray(contract.sideQuestGuard));
    assert.ok(contract.sideQuestGuard.some((item) => /research|browse/i.test(item)));
    console.log('PASS task contract');
}

function testToolRelevanceGuard() {
    console.log('--- Testing Tool Relevance Guard ---');
    const orchestrator = new NexusOrchestrator();
    orchestrator.currentTaskContract = orchestrator._buildTaskContract('fix the bug in the codebase');

    const relevantTool = orchestrator._isToolRelevantToTask({
        name: 'readFile',
        args: { absolutePath: 'D:/repo/index.js' }
    });
    const irrelevantTool = orchestrator._isToolRelevantToTask({
        name: 'sendEmail',
        args: { to: 'client@example.com', subject: 'Hello' }
    });

    assert.strictEqual(relevantTool, true, 'Code tools should remain allowed for code tasks');
    assert.strictEqual(irrelevantTool, false, 'Outbound tools should be blocked for code-only tasks');
    console.log('PASS tool relevance guard');
}

function testCompletionEvidence() {
    console.log('--- Testing Completion Evidence ---');
    const orchestrator = new NexusOrchestrator();
    orchestrator.currentTaskContract = orchestrator._buildTaskContract('create a quote for Acme');

    const deniedBeforeArtifact = orchestrator._canDeclareTaskComplete('Task complete');
    assert.strictEqual(deniedBeforeArtifact, false, 'Completion should be denied without deliverable evidence');

    orchestrator.currentMissionArtifact = {
        kind: 'quote_bundle',
        files: {
            pdf: 'D:/nexusOS-LLM-stable/nexusOS-LLM/outputs/quote.pdf',
            markdown: 'D:/nexusOS-LLM-stable/nexusOS-LLM/outputs/quote.md'
        }
    };

    const allowedAfterArtifact = orchestrator._canDeclareTaskComplete('Task complete');
    assert.strictEqual(allowedAfterArtifact, true, 'Completion should be allowed after quote artifact exists');
    console.log('PASS completion evidence');
}

function testClarificationDeduping() {
    console.log('--- Testing Clarification Deduping ---');
    const orchestrator = new NexusOrchestrator();

    const first = orchestrator._shouldAskClarification('What exact email address should I use?');
    assert.strictEqual(first.allow, true, 'First clarification should be allowed');

    orchestrator.pendingClarification = {
        question: 'What exact email address should I use?',
        normalized: orchestrator._normalizeClarificationQuestion('What exact email address should I use?')
    };

    const duplicate = orchestrator._shouldAskClarification('What exact email address should I use?');
    assert.strictEqual(duplicate.allow, false, 'Duplicate clarification should be blocked');

    const extracted = orchestrator._extractClarificationQuestion('I need your input.\nWhat exact email address should I use?');
    assert.strictEqual(extracted, 'What exact email address should I use?');
    console.log('PASS clarification deduping');
}

function run() {
    testMissionModeRouting();
    testTaskContract();
    testToolRelevanceGuard();
    testCompletionEvidence();
    testClarificationDeduping();
    console.log('--- Nexus Regression Guards Passed ---');
}

run();
