const assert = require('assert');
const NexusOrchestrator = require('../index');

function testHallucinationTrap() {
    console.log('--- Testing Hallucination Trap ---');

    const orchestrator = new NexusOrchestrator();

    const hallucinatedImage = 'I have successfully generated the image for you. Here it is: [Image: boy_pickle.png]. Task Complete.';
    orchestrator.currentTaskContract = orchestrator._buildTaskContract('Generate an image of a boy.');

    assert.strictEqual(
        orchestrator._containsNarratedToolSuccess(hallucinatedImage),
        true,
        'Narrated fake image success should be detected'
    );

    const imageCorrection = orchestrator._buildNarratedActionCorrection('Generate an image of a boy.');
    assert.ok(
        imageCorrection.includes('generateImage'),
        'Image hallucination correction should force generateImage'
    );

    orchestrator.currentTaskContract = orchestrator._buildTaskContract('create a quote for monthly services');
    const hallucinatedQuote = 'Quote is ready and saved to proposal.pdf. Mission complete.';
    assert.strictEqual(
        orchestrator._containsNarratedToolSuccess(hallucinatedQuote),
        true,
        'Narrated fake quote deliverable should be detected'
    );

    const quoteCorrection = orchestrator._buildNarratedActionCorrection('create a quote for monthly services');
    assert.ok(
        quoteCorrection.includes('buildAgencyQuotePlan') || quoteCorrection.includes('createAgencyQuoteArtifacts'),
        'Commercial hallucination correction should force quote tools'
    );

    orchestrator.currentTaskContract = orchestrator._buildTaskContract('open https://example.com and fill the form');
    const browserCorrection = orchestrator._buildNarratedActionCorrection('open https://example.com and fill the form');
    assert.ok(
        browserCorrection.includes('browserAction'),
        'Browser hallucination correction should force browserAction'
    );

    console.log('--- Hallucination Trap Test PASSED ---');
}

testHallucinationTrap();
