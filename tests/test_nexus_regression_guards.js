const assert = require('assert');
const NexusOrchestrator = require('../index');
const MissionMode = require('../core/missionMode');
const BrowserTool = require('../tools/browser');
const LLMService = require('../core/llm');

function testMissionModeRouting() {
    console.log('--- Testing Mission Mode Routing ---');
    const planMode = MissionMode.detectMissionMode('analyze this landing page and tell me what is wrong');
    const executeMode = MissionMode.detectMissionMode('create a banner for my ad campaign');
    const browserFormMode = MissionMode.detectMissionMode('open this website, fill the form, and submit it');
    const browserLoginMode = MissionMode.detectMissionMode('open facebook.com and enter the username and password');

    assert.strictEqual(planMode, 'plan', 'Ambiguous analysis requests should prefer PLAN mode');
    assert.strictEqual(executeMode, 'execute', 'Concrete creation requests should prefer EXECUTE mode');
    assert.strictEqual(browserFormMode, 'execute', 'Generic browser automation should stay in EXECUTE mode');
    assert.strictEqual(browserLoginMode, 'execute', 'Browser credential entry should stay in EXECUTE mode');
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

function testTaskRoutingProfile() {
    console.log('--- Testing Task Routing Profile ---');
    const orchestrator = new NexusOrchestrator();
    const browserContract = orchestrator._buildTaskContract('open this website, fill the form, and submit');
    const codeContract = orchestrator._buildTaskContract('fix the bug in server.js and verify the code');
    const commercialContract = orchestrator._buildTaskContract('create a quote for monthly marketing retainer');
    const imageContract = orchestrator._buildTaskContract('create a fashion banner image for an ad');
    const videoContract = orchestrator._buildTaskContract('create a promo reel video for our launch');
    const organicMetaContract = orchestrator._buildTaskContract('create an organic single image ad for facebook chicken pickles');

    assert.strictEqual(browserContract.routingProfile.domain, 'browser');
    assert.ok(browserContract.routingProfile.allowedTools.includes('browserAction'));
    assert.strictEqual(codeContract.routingProfile.domain, 'code');
    assert.ok(codeContract.routingProfile.allowedTools.includes('readFile'));
    assert.strictEqual(commercialContract.routingProfile.domain, 'commercial');
    assert.ok(commercialContract.routingProfile.allowedTools.includes('createAgencyQuoteArtifacts'));
    assert.strictEqual(imageContract.routingProfile.domain, 'image');
    assert.ok(imageContract.routingProfile.allowedTools.includes('generateImage'));
    assert.strictEqual(imageContract.routingProfile.allowedTools.includes('generateVideo'), false);
    assert.strictEqual(videoContract.routingProfile.domain, 'video');
    assert.ok(videoContract.routingProfile.allowedTools.includes('generateVideo'));
    assert.strictEqual(videoContract.routingProfile.allowedTools.includes('generateImage'), false);
    assert.strictEqual(organicMetaContract.routingProfile.domain, 'marketing');
    assert.ok(organicMetaContract.routingProfile.allowedTools.includes('generateImage'));
    assert.ok(organicMetaContract.routingProfile.allowedTools.includes('metaAds'));
    console.log('PASS task routing profile');
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

function testBrowserContinuationGuard() {
    console.log('--- Testing Browser Continuation Guard ---');
    const orchestrator = new NexusOrchestrator();

    assert.strictEqual(
        orchestrator._shouldForceBrowserContinuation('open this quiz page, answer questions, and submit'),
        true,
        'Browser missions should force continuation mode'
    );

    assert.strictEqual(
        orchestrator._isBrowserHesitationResponse('I do not have the inherent knowledge to give correct answers.'),
        true,
        'Early browser hesitation should be detected'
    );

    console.log('PASS browser continuation guard');
}

function testBrowserToolAssignment() {
    console.log('--- Testing Browser Tool Assignment ---');
    const orchestrator = new NexusOrchestrator();
    orchestrator.currentMissionMode = 'execute';
    orchestrator.currentRun = { toolsUsed: { browserAction: 1 } };

    const options = orchestrator._getLlmOptionsForCurrentMission();

    assert.ok(Array.isArray(options.allowedTools), 'Browser missions should constrain the available tools');
    assert.strictEqual(options.allowedTools.includes('browserAction'), true, 'Browser tool must stay available');
    assert.strictEqual(options.allowedTools.includes('generateImage'), false, 'Unrelated media tools should not be exposed in browser-first mode');
    console.log('PASS browser tool assignment');
}

function testCodeToolAssignment() {
    console.log('--- Testing Code Tool Assignment ---');
    const orchestrator = new NexusOrchestrator();
    orchestrator.currentMissionMode = 'execute';
    orchestrator.currentTaskContract = orchestrator._buildTaskContract('fix the bug in the codebase and update the file');

    const options = orchestrator._getLlmOptionsForCurrentMission();
    assert.ok(Array.isArray(options.allowedTools), 'Code tasks should constrain allowed tools');
    assert.strictEqual(options.allowedTools.includes('readFile'), true);
    assert.strictEqual(options.allowedTools.includes('browserAction'), false);
    assert.strictEqual(options.allowedTools.includes('metaAds'), false);
    console.log('PASS code tool assignment');
}

function testBrowserFollowUpAndCompletionEvidence() {
    console.log('--- Testing Browser Follow-Up And Completion Evidence ---');
    const orchestrator = new NexusOrchestrator();
    orchestrator.currentMissionMode = 'execute';
    orchestrator.currentRun = { toolsUsed: {} };
    orchestrator.currentTaskContract = orchestrator._buildTaskContract('open a quiz page, answer questions, and submit');

    assert.strictEqual(orchestrator._isMissionFollowUpRequest('proceed'), false, 'Proceed should not attach to browser mission without actual browser progress');
    assert.strictEqual(orchestrator._canDeclareTaskComplete('Task complete'), false, 'Browser missions should not complete without real browser evidence');

    orchestrator.currentRun = { toolsUsed: { browserAction: 2 } };
    assert.strictEqual(orchestrator._isMissionFollowUpRequest('proceed'), true, 'Proceed should continue an active browser mission after browser progress exists');
    assert.strictEqual(orchestrator._canDeclareTaskComplete('Task complete'), true, 'Browser missions may complete after real browser tool evidence exists');
    console.log('PASS browser follow-up and completion evidence');
}

function testBrowserSelectorNormalization() {
    console.log('--- Testing Browser Selector Normalization ---');
    const browser = new BrowserTool();
    assert.strictEqual(browser._normalizeSelector('div:contains("ప్రశ్న")'), '::-p-text(ప్రశ్న)');
    assert.strictEqual(browser._normalizeSelector('#input-v-5'), '#input-v-5');
    console.log('PASS browser selector normalization');
}

function testProviderPinning() {
    console.log('--- Testing Provider Pinning ---');
    const llm = new LLMService();
    llm.providerPins.set('session-demo', 'OpenRouter');
    assert.strictEqual(llm.providerPins.get('session-demo'), 'OpenRouter');
    const chain = llm._buildProviderChain({
        geminiProvider: { name: 'Gemini' },
        openRouterPrimary: { name: 'OpenRouter' },
        fallbackProviders: [{ name: 'Groq' }, { name: 'NVIDIA' }]
    });
    assert.deepStrictEqual(chain.map((provider) => provider.name), ['Gemini', 'OpenRouter', 'Groq', 'NVIDIA']);
    console.log('PASS provider pinning');
}

function testNarratedToolSalvage() {
    console.log('--- Testing Narrated Tool Salvage ---');
    const orchestrator = new NexusOrchestrator();
    const salvaged = orchestrator._extractToolCallFromNarration(`
    **Tool Call:**
    \`\`\`json
    {
      "tool_code": "print(self.tool_code_manager.browserAction(action='open', url='https://example.com'))"
    }
    \`\`\`
    `);
    assert.ok(salvaged, 'Narrated tool text should be salvageable');
    assert.strictEqual(salvaged.name, 'browserAction');
    assert.strictEqual(salvaged.args.action, 'open');
    assert.strictEqual(salvaged.args.url, 'https://example.com');
    console.log('PASS narrated tool salvage');
}

function testUrlExtraction() {
    console.log('--- Testing URL Extraction ---');
    const orchestrator = new NexusOrchestrator();
    assert.strictEqual(
        orchestrator._extractFirstUrl('open https://www.facebook.com/ and continue'),
        'https://www.facebook.com/'
    );
    assert.strictEqual(
        orchestrator._extractFirstUrl('no url here'),
        null
    );
    console.log('PASS URL extraction');
}

function testWeakBrowserTextTurnDetection() {
    console.log('--- Testing Weak Browser Text Turn Detection ---');
    const orchestrator = new NexusOrchestrator();
    orchestrator.currentTaskContract = orchestrator._buildTaskContract('open a website and submit a quiz');

    assert.strictEqual(
        orchestrator._isWeakBrowserTextTurn({ text: "Here's my plan: I will open the page and proceed." }, 'open https://example.com and continue'),
        true,
        'Browser planning chatter should be treated as a weak text turn'
    );
    assert.strictEqual(
        orchestrator._isWeakBrowserTextTurn({ text: 'Successfully opened the page.', toolCall: { name: 'browserAction', args: { action: 'open' } } }, 'open https://example.com and continue'),
        false,
        'Real browser tool turns should not be treated as weak text turns'
    );
    console.log('PASS weak browser text turn detection');
}

function testMetaOrganicImageDetection() {
    console.log('--- Testing Meta Organic Image Detection ---');
    const orchestrator = new NexusOrchestrator();
    assert.strictEqual(
        orchestrator._isMetaOrganicImageRequest('create an organic single image ad for facebook chicken pickles'),
        true
    );
    assert.strictEqual(
        orchestrator._isMetaOrganicImageRequest('fix a backend bug in server.js'),
        false
    );
    console.log('PASS meta organic image detection');
}

function testGeminiFormattingSkipsNonStringAssistantContent() {
    console.log('--- Testing Gemini Formatting Guard ---');
    const llm = new LLMService();
    const formatted = llm.formatMessagesForGemini([
        { role: 'system', content: 'System ready' },
        { role: 'assistant', content: { bad: 'payload' }, toolCall: { name: 'browserAction', args: { action: 'open', url: 'https://example.com' } } },
        { role: 'tool', name: 'browserAction', content: { ok: true } }
    ]);

    assert.ok(Array.isArray(formatted));
    assert.strictEqual(formatted[1].parts.some((part) => typeof part.text !== 'undefined'), false, 'Non-string assistant content should not be emitted as a Gemini text part');
    assert.ok(formatted[1].parts.some((part) => part.functionCall), 'Function call should still be preserved');
    assert.ok(formatted[2].parts.some((part) => part.functionResponse), 'Function response should use SDK-compatible camelCase');
    console.log('PASS Gemini formatting guard');
}

function run() {
    testMissionModeRouting();
    testTaskContract();
    testTaskRoutingProfile();
    testToolRelevanceGuard();
    testCompletionEvidence();
    testClarificationDeduping();
    testBrowserContinuationGuard();
    testBrowserToolAssignment();
    testCodeToolAssignment();
    testBrowserFollowUpAndCompletionEvidence();
    testBrowserSelectorNormalization();
    testProviderPinning();
    testNarratedToolSalvage();
    testUrlExtraction();
    testWeakBrowserTextTurnDetection();
    testMetaOrganicImageDetection();
    testGeminiFormattingSkipsNonStringAssistantContent();
    console.log('--- Nexus Regression Guards Passed ---');
}

run();
