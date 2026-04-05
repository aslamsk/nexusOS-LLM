const assert = require('assert');
const NexusOrchestrator = require('../index');
const MissionMode = require('../core/missionMode');
const BrowserTool = require('../tools/browser');
const LLMService = require('../core/llm');
const fs = require('fs');
const SquadSystem = require('../core/squad');
const DomainPolicy = require('../core/domainPolicy');
const CapabilityResponses = require('../core/capabilityResponses');
const TaskContract = require('../core/taskContract');
const BrowserMissionPolicy = require('../core/browserMissionPolicy');
const MissionStatus = require('../core/missionStatus');
const MissionGuards = require('../core/missionGuards');
const MissionContinuity = require('../core/missionContinuity');
const MissionMemory = require('../core/missionMemory');
const ToolDispatchPolicy = require('../core/toolDispatchPolicy');
const ToolArgumentHydrator = require('../core/toolArgumentHydrator');
const GovernanceRuntime = require('../core/governanceRuntime');
const SelfHealingRuntime = require('../core/selfHealingRuntime');
const ExternalActionPolicy = require('../core/externalActionPolicy');
const ToolExecutionRuntime = require('../core/toolExecutionRuntime');
const QueryEngine = require('../core/queryEngine');
const QueryTurnRuntime = require('../core/queryTurnRuntime');
const TurnHandlers = require('../core/turnHandlers');
const LoopFinalizer = require('../core/loopFinalizer');
const MissionStateRuntime = require('../core/missionStateRuntime');
const ToolEvidenceRuntime = require('../core/toolEvidenceRuntime');
const CreativePromptRuntime = require('../core/creativePromptRuntime');
const PreflightPlanRuntime = require('../core/preflightPlanRuntime');
const ConfigService = require('../core/config');
const RuntimeFailureRuntime = require('../core/runtimeFailureRuntime');
const RequirementRuntime = require('../core/requirementRuntime');
const { cloneProfile, buildCapabilitySummary, buildMetaWaysSummary, buildMetaTypesSummary } = require('../core/toolRegistry');

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

function testContextHygieneGuards() {
    console.log('--- Testing Context Hygiene Guards ---');
    const orchestrator = new NexusOrchestrator();
    assert.strictEqual(orchestrator._shouldRecallLongTermMemory('browser'), false);
    assert.strictEqual(orchestrator._shouldRecallLongTermMemory('image'), false);
    assert.strictEqual(orchestrator._shouldRecallLongTermMemory('marketing'), true);

    assert.strictEqual(orchestrator._shouldInjectMarketingWorkflow('marketing'), true);
    assert.strictEqual(orchestrator._shouldInjectMarketingWorkflow('browser'), false);

    assert.strictEqual(orchestrator._shouldAutoLoadSpecialistSkill('create a fashion banner image for pickle brand', 'image'), false);
    assert.strictEqual(orchestrator._shouldAutoLoadSpecialistSkill('perform a deep SEO audit for this site architecture and strategy', 'marketing'), true);
    console.log('PASS context hygiene guards');
}

function testDomainPolicyExtraction() {
    console.log('--- Testing Domain Policy Extraction ---');
    const browserProfile = DomainPolicy.deriveTaskRoutingProfile('open website and fill form');
    const imageProfile = DomainPolicy.deriveTaskRoutingProfile('create image banner creative');
    const marketingProfile = DomainPolicy.deriveTaskRoutingProfile('run marketing competitor research audit');
    const organicVideoPromoteProfile = DomainPolicy.deriveTaskRoutingProfile('promot this youtube video in metaAds organic');
    const browserMarketingProfile = DomainPolicy.deriveTaskRoutingProfile('get product details from this website and promote it in meta ads');
    assert.strictEqual(browserProfile.domain, 'browser');
    assert.strictEqual(imageProfile.domain, 'image');
    assert.strictEqual(marketingProfile.domain, 'marketing');
    assert.strictEqual(organicVideoPromoteProfile.domain.includes('marketing_meta_organic'), true);
    assert.strictEqual(organicVideoPromoteProfile.allowedTools.includes('metaAds'), true);
    assert.strictEqual(browserMarketingProfile.domain.includes('browser'), true);
    assert.strictEqual(browserMarketingProfile.domain.includes('marketing_meta_organic'), true);
    assert.strictEqual(browserMarketingProfile.allowedTools.includes('browserAction'), true);
    assert.strictEqual(browserMarketingProfile.allowedTools.includes('metaAds'), true);
    assert.strictEqual(browserMarketingProfile.allowedTools.includes('searchWeb'), false);
    assert.strictEqual(DomainPolicy.shouldRecallLongTermMemory('browser'), false);
    assert.strictEqual(DomainPolicy.shouldInjectMarketingWorkflow('marketing'), true);
    assert.strictEqual(DomainPolicy.shouldAutoLoadSpecialistSkill('deep seo architecture audit', 'marketing'), true);
    assert.strictEqual(
        DomainPolicy.isToolRelevantToTask({
            toolCall: { name: 'readFile', args: { absolutePath: 'D:/repo/index.js' } },
            request: 'fix the bug in the codebase',
            routingProfile: DomainPolicy.deriveTaskRoutingProfile('fix the bug in the codebase')
        }),
        true
    );
    assert.strictEqual(
        DomainPolicy.isToolRelevantToTask({
            toolCall: { name: 'sendEmail', args: { to: 'client@example.com' } },
            request: 'fix the bug in the codebase',
            routingProfile: DomainPolicy.deriveTaskRoutingProfile('fix the bug in the codebase')
        }),
        false
    );
    console.log('PASS domain policy extraction');
}

function testCapabilityModuleExtraction() {
    console.log('--- Testing Capability Module Extraction ---');
    assert.strictEqual(CapabilityResponses.isCapabilityQuestion('explain me all of your skills'), true);
    assert.ok(/2 real ways/i.test(CapabilityResponses.buildCapabilityResponse('how many ways u can do metaads')));
    assert.ok(/should not claim full support/i.test(CapabilityResponses.buildCapabilityResponse('what types ads u can do on meta')));
    console.log('PASS capability module extraction');
}

function testTaskContractModuleExtraction() {
    console.log('--- Testing Task Contract Module Extraction ---');
    const contract = TaskContract.buildTaskContract('create a quote for Acme for monthly marketing services', (lower) => DomainPolicy.deriveTaskRoutingProfile(lower));
    assert.ok(contract);
    assert.ok(String(contract.expectedDeliverable).includes('quote'));
    const prompt = TaskContract.buildTaskContractPrompt(contract);
    assert.ok(/TASK CONTRACT/i.test(prompt));
    assert.ok(/Primary domain:/i.test(prompt));
    console.log('PASS task contract module extraction');
}

async function testQueryEngineBootstrapExtraction() {
    console.log('--- Testing Query Engine Bootstrap Extraction ---');
    const updates = [];
    const orchestrator = new NexusOrchestrator((event) => updates.push(event));
    const result = await QueryEngine.prepareMissionBootstrap(orchestrator, 'create a quote for Acme for monthly marketing services');
    assert.strictEqual(result.handled, false);
    assert.strictEqual(result.augmentedRequest.includes('create a quote'), true);
    assert.strictEqual(orchestrator.activeMissionDomain, 'commercial');
    assert.strictEqual(orchestrator.currentMissionMode, 'execute');
    assert.strictEqual(orchestrator.context[orchestrator.context.length - 1].role, 'user');
    assert.ok(/MISSION DIRECTIVE/i.test(orchestrator.context[orchestrator.context.length - 1].content));
    assert.ok(/create a quote for Acme/i.test(orchestrator.context[orchestrator.context.length - 1].content));
    assert.ok(updates.some((event) => String(event.message || '').includes('Task routing locked')));
    assert.ok(updates.some((event) => String(event.message || '').includes('Preflight plan locked')));
    console.log('PASS query engine bootstrap extraction');
}

async function testQueryEnginePreflightPause() {
    console.log('--- Testing Query Engine Preflight Pause ---');
    const updates = [];
    const orchestrator = new NexusOrchestrator((event) => updates.push(event));
    orchestrator._finishRun = () => {};
    const result = await QueryEngine.prepareMissionBootstrap(orchestrator, 'open facebook.com and login');
    assert.strictEqual(result.handled, true);
    assert.strictEqual(orchestrator.isWaitingForInput, true);
    assert.ok(updates.some((event) => event.type === 'input_requested' && /login username\/email/i.test(String(event.message || ''))));
    console.log('PASS query engine preflight pause');
}

async function testUnhandledRuntimeErrorPause() {
    console.log('--- Testing Unhandled Runtime Error Pause ---');
    const updates = [];
    const orchestrator = new NexusOrchestrator((event) => updates.push(event));
    orchestrator._finishRun = () => {};
    const handled = await orchestrator._handleUnhandledRuntimeError(new TypeError('String(...).ToLower is not a function'));
    assert.strictEqual(handled, true);
    assert.strictEqual(orchestrator.isWaitingForInput, true);
    assert.ok(orchestrator.pendingRepair);
    assert.strictEqual(orchestrator.pendingRepair.classification.type, 'runtime_logic_error');
    assert.ok(updates.some((event) => event.type === 'repair_suggested'));
    console.log('PASS unhandled runtime error pause');
}

async function testMetaRequirementDetection() {
    console.log('--- Testing Meta Requirement Detection ---');
    const updates = [];
    const orchestrator = new NexusOrchestrator((event) => updates.push(event));
    orchestrator._finishRun = () => {};

    const expiredHandled = await orchestrator._handleToolRequirement(
        { name: 'metaAds', args: { action: 'publishOrganicPost', pageId: '12345' } },
        '{"error":"Error validating access token: Session has expired","details":{"code":190,"error_subcode":463}}'
    );
    assert.strictEqual(expiredHandled, true);
    assert.ok(updates.some((event) => event.type === 'input_requested' && /META_ACCESS_TOKEN/i.test(String(event.message || ''))));

    const updates2 = [];
    const orchestrator2 = new NexusOrchestrator((event) => updates2.push(event));
    orchestrator2._finishRun = () => {};
    const pageHandled = await orchestrator2._handleToolRequirement(
        { name: 'metaAds', args: { action: 'publishOrganicPost', pageId: 'EAAFakeTokenValue123' } },
        'Meta publish failed'
    );
    assert.strictEqual(pageHandled, true);
    assert.ok(updates2.some((event) => event.type === 'input_requested' && /META_PAGE_ID/i.test(String(event.message || ''))));
    console.log('PASS meta requirement detection');
}

function testRequirementRuntimeExtraction() {
    console.log('--- Testing Requirement Runtime Extraction ---');
    const meta = RequirementRuntime.classifyToolRequirement({
        toolCall: { name: 'metaAds', args: { action: 'publishOrganicPost', pageId: '12345' } },
        resultString: 'Error validating access token: Session has expired',
        scope: 'boss',
        scopeLabel: 'Boss workspace',
        looksLikeMetaToken: () => false
    });
    assert.ok(meta);
    assert.deepStrictEqual(meta.keys, ['META_ACCESS_TOKEN']);

    const google = RequirementRuntime.classifyToolRequirement({
        toolCall: { name: 'googleAds', args: { action: 'createCampaign' } },
        resultString: 'Google Ads action createCampaign is blocked by missing setup: GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_REFRESH_TOKEN.',
        scope: 'boss',
        scopeLabel: 'Boss workspace',
        looksLikeMetaToken: () => false
    });
    assert.ok(google);
    assert.ok(google.keys.includes('GOOGLE_ADS_CLIENT_ID'));
    assert.ok(google.keys.includes('GOOGLE_ADS_REFRESH_TOKEN'));

    const gmail = RequirementRuntime.classifyToolRequirement({
        toolCall: { name: 'sendEmail', args: {} },
        resultString: 'GMAIL_USER missing and GMAIL_APP_PASSWORD not configured',
        scope: 'boss',
        scopeLabel: 'Boss workspace',
        looksLikeMetaToken: () => false
    });
    assert.ok(gmail);
    assert.ok(gmail.keys.includes('GMAIL_USER'));
    assert.ok(gmail.keys.includes('GMAIL_APP_PASSWORD'));

    const asset = RequirementRuntime.classifyToolRequirement({
        toolCall: { name: 'metaAds', args: { action: 'publishOrganicPost' } },
        resultString: '{"ok":false,"error":"Meta action publishOrganicPost blocked: banner/image must be generated first.","missingKeys":["IMAGE_ASSET"]}',
        scope: 'boss',
        scopeLabel: 'Boss workspace',
        looksLikeMetaToken: () => false
    });
    assert.ok(asset);
    assert.strictEqual(asset.kind, 'transient_asset');
    console.log('PASS requirement runtime extraction');
}

async function testDirectOrganicMetaKickoff() {
    console.log('--- Testing Direct Organic Meta Kickoff ---');
    const updates = [];
    const orchestrator = new NexusOrchestrator((event) => updates.push(event));
    orchestrator.currentTaskContract = orchestrator._buildTaskContract('promot this youtube video in metaAds organic : https://www.youtube.com/watch?v=rbFMSL2DYCc');
    orchestrator.activeMissionDomain = orchestrator.currentTaskContract.routingProfile.domain;
    orchestrator.currentMissionMode = 'execute';
    const originalGet = orchestrator._hydrateToolCall;
    const originalConfigGet = ConfigService.get;
    orchestrator._hydrateToolCall = (toolCall) => originalGet.call(orchestrator, toolCall);
    ConfigService.get = async (key) => (key === 'META_PAGE_ID' ? 'page_123' : null);
    try {
        const kicked = await orchestrator._handleDirectOrganicMetaKickoff('promot this youtube video in metaAds organic : https://www.youtube.com/watch?v=rbFMSL2DYCc');
        assert.strictEqual(kicked, true);
        assert.strictEqual(orchestrator.isWaitingForInput, true);
        assert.ok(orchestrator.pendingApproval);
        assert.strictEqual(orchestrator.pendingApproval.toolCall.name, 'metaAds');
        assert.strictEqual(orchestrator.pendingApproval.toolCall.args.action, 'publishOrganicPost');
        assert.strictEqual(orchestrator.pendingApproval.toolCall.args.link, 'https://www.youtube.com/watch?v=rbFMSL2DYCc');
        assert.deepStrictEqual(orchestrator.pendingApproval.toolCall.args.channels, ['facebook']);
        assert.ok(updates.some((event) => event.type === 'approval_requested'));
    } finally {
        ConfigService.get = originalConfigGet;
    }
    console.log('PASS direct organic meta kickoff');
}

function testManualProductPromotionDraftExtraction() {
    console.log('--- Testing Manual Product Promotion Draft Extraction ---');
    const orchestrator = new NexusOrchestrator();
    const draft = orchestrator._extractManualProductPromotionDraft(`product name : Poly Cotton Solid Half Sleeves Mens Polo T-shirt (Pack of 3)
description: This pack of three Poly Cotton Solid Half Sleeves Men's Polo T-shirts is a versatile addition to any man's wardrobe.
Product URL: https://mkfashion.in/p/GB17-i5ZVK
product image URL: https://cdn.example.com/product.jpg
Price: 444 Only
promote this in Meta Ads organic with best tags u can improve description`);
    assert.ok(draft);
    assert.strictEqual(draft.title.includes('Polo T-shirt'), true);
    assert.strictEqual(draft.link, 'https://mkfashion.in/p/GB17-i5ZVK');
    assert.strictEqual(draft.imageUrl, 'https://cdn.example.com/product.jpg');
    assert.ok(/Shop now/i.test(draft.message));
    console.log('PASS manual product promotion draft extraction');
}

async function testMixedProductPromotionSkipsDirectOrganicKickoff() {
    console.log('--- Testing Mixed Product Promotion Skip Direct Kickoff ---');
    const updates = [];
    const orchestrator = new NexusOrchestrator((event) => updates.push(event));
    orchestrator.currentTaskContract = orchestrator._buildTaskContract('get product details from this website and promote it in meta ads https://example.com/product/1');
    orchestrator.activeMissionDomain = orchestrator.currentTaskContract.routingProfile.domain;
    orchestrator.currentMissionMode = 'execute';
    const kicked = await orchestrator._handleDirectOrganicMetaKickoff('get product details from this website and promote it in meta ads https://example.com/product/1');
    assert.strictEqual(kicked, false);
    assert.strictEqual(updates.some((event) => /Direct organic Meta kickoff/i.test(String(event.message || ''))), false);
    console.log('PASS mixed product promotion skip direct kickoff');
}

async function testSingleKeyRequirementColonParsing() {
    console.log('--- Testing Single Key Requirement Colon Parsing ---');
    const updates = [];
    const orchestrator = new NexusOrchestrator((event) => updates.push(event));
    orchestrator.resume = async () => {};
    orchestrator._saveRequirementValues = async () => ({ scopeLabel: 'Boss workspace' });
    orchestrator.pendingRequirement = {
        keys: ['META_PAGE_ID'],
        scope: 'boss',
        toolCall: { name: 'metaAds', args: { action: 'publishOrganicPost' } }
    };
    await orchestrator._handleRequirementResponse('META_PAGE_ID : 106214568034999');
    assert.strictEqual(orchestrator.pendingRequirement, null);
    assert.ok(updates.some((event) => /Saved META_PAGE_ID/i.test(String(event.message || ''))));
    console.log('PASS single key requirement colon parsing');
}

async function testTransientAssetRequirementUrlHandling() {
    console.log('--- Testing Transient Asset Requirement URL Handling ---');
    const updates = [];
    const orchestrator = new NexusOrchestrator((event) => updates.push(event));
    orchestrator.resume = async () => {};
    orchestrator.currentOrganicMetaDraft = { message: 'hello', link: 'https://example.com', imagePath: null, imageUrl: null };
    orchestrator.pendingApproval = { toolCall: { name: 'metaAds', args: { action: 'publishOrganicPost' } } };
    orchestrator.pendingRequirement = {
        keys: ['IMAGE_ASSET'],
        scope: 'boss',
        kind: 'transient_asset',
        toolCall: { name: 'metaAds', args: { action: 'publishOrganicPost' } }
    };
    await orchestrator._handleRequirementResponse('https://cdn.example.com/product.jpg');
    assert.strictEqual(orchestrator.pendingRequirement, null);
    assert.strictEqual(orchestrator.currentOrganicMetaDraft.imagePath, 'https://cdn.example.com/product.jpg');
    assert.strictEqual(orchestrator.pendingApproval.toolCall.args.imagePath, 'https://cdn.example.com/product.jpg');
    console.log('PASS transient asset requirement url handling');
}

async function testQueryEngineLoopDelegation() {
    console.log('--- Testing Query Engine Loop Delegation ---');
    const orchestrator = new NexusOrchestrator();
    let executeDelegated = false;
    const originalCore = orchestrator._runLoopCore;
    orchestrator._runLoopCore = async (request) => {
        executeDelegated = request === 'demo request';
    };
    await orchestrator._runLoop('demo request');
    orchestrator._runLoopCore = originalCore;
    assert.strictEqual(executeDelegated, true);

    const chatUpdates = [];
    const chatOrchestrator = new NexusOrchestrator((event) => chatUpdates.push(event));
    chatOrchestrator._finishRun = () => {};
    chatOrchestrator.llmService.generateResponse = async () => ({
        text: 'Hello from chat loop',
        provider: 'TestProvider',
        model: 'test-model',
        usage: {}
    });
    chatOrchestrator.currentRun = {
        id: 'run_test',
        requestPreview: 'hello',
        providerUsage: {}
    };
    await chatOrchestrator._runChatLoop();
    assert.ok(chatUpdates.some((event) => String(event.message || '').includes('Hello from chat loop')));
    console.log('PASS query engine loop delegation');
}

async function testQueryTurnRuntimeExtraction() {
    console.log('--- Testing Query Turn Runtime Extraction ---');
    const orchestrator = new NexusOrchestrator();
    orchestrator.lastUploadedFile = 'banner.png';
    orchestrator.currentTaskContract = orchestrator._buildTaskContract('create image banner');
    const stateContext = await QueryTurnRuntime.buildStateContext(orchestrator);
    assert.ok(stateContext.includes('Active File Context'));
    assert.ok(stateContext.includes('TASK CONTRACT'));

    QueryTurnRuntime.applyStateContext(orchestrator, stateContext);
    assert.ok(orchestrator.context[0].content.includes('Active File Context'));

    orchestrator.llmService.generateResponse = async () => ({
        text: 'tool ready',
        provider: 'TestProvider',
        model: 'test-model',
        usage: {}
    });
    orchestrator.currentRun = {
        id: 'run_turn',
        requestPreview: 'create image banner',
        providerUsage: {}
    };
    const turnResult = await QueryTurnRuntime.getTurnResponse(orchestrator, 0, 3);
    assert.strictEqual(turnResult.stop, false);
    assert.strictEqual(turnResult.response.text, 'tool ready');
    console.log('PASS query turn runtime extraction');
}

async function testTurnHandlersExtraction() {
    console.log('--- Testing Turn Handlers Extraction ---');
    const textUpdates = [];
    const textOrchestrator = new NexusOrchestrator((event) => textUpdates.push(event));
    textOrchestrator._finishRun = () => {};
    const textResult = await TurnHandlers.handleAssistantText(textOrchestrator, {
        text: 'Prepared a useful response',
        parts: []
    }, 'create useful response');
    assert.strictEqual(textResult.paused, false);
    assert.ok(textUpdates.some((event) => String(event.message || '').includes('Prepared a useful response')));

    const toolUpdates = [];
    const toolOrchestrator = new NexusOrchestrator((event) => toolUpdates.push(event));
    toolOrchestrator._finishRun = () => {};
    toolOrchestrator.dispatchTool = async () => 'File saved successfully';
    toolOrchestrator._captureToolOutcome = () => {};
    toolOrchestrator._formatToolResult = (value) => String(value);
    toolOrchestrator._handleToolRequirement = async () => false;
    toolOrchestrator._applySelfHealing = async () => {};
    const toolResult = await TurnHandlers.executeToolTurn(toolOrchestrator, {
        text: '',
        toolCall: { name: 'writeFile', args: { absolutePath: 'x', content: 'y' } },
        provider: 'TestProvider',
        model: 'test-model',
        parts: []
    });
    assert.strictEqual(toolResult.paused, false);
    assert.ok(toolUpdates.some((event) => event.type === 'action'));

    const textOnlyOrchestrator = new NexusOrchestrator();
    textOnlyOrchestrator._finishRun = () => {};
    textOnlyOrchestrator._canDeclareTaskComplete = () => false;
    textOnlyOrchestrator._containsNarratedToolSuccess = () => false;
    textOnlyOrchestrator._shouldForceBrowserContinuation = () => false;
    textOnlyOrchestrator._buildDeterministicToolCorrection = () => '';
    textOnlyOrchestrator._isWeakBrowserTextTurn = () => false;
    textOnlyOrchestrator.currentMissionMode = 'execute';
    const textOnlyResult = await TurnHandlers.handleTextOnlyTurn(textOnlyOrchestrator, {
        text: 'I am thinking about the next step',
        toolCall: null
    }, 'do the task');
    assert.strictEqual(textOnlyResult.needsContinue, true);
    console.log('PASS turn handlers extraction');
}

async function testBrowserFirstMissionCorrections() {
    console.log('--- Testing Browser First Mission Corrections ---');
    const updates = [];
    const orchestrator = new NexusOrchestrator((event) => updates.push(event));
    orchestrator.currentTaskContract = orchestrator._buildTaskContract('get product details from this website and promote it in meta ads https://example.com/p/1');
    orchestrator.activeMissionDomain = orchestrator.currentTaskContract.routingProfile.domain;
    orchestrator.currentMissionMode = 'execute';
    orchestrator._finishRun = () => {};
    orchestrator._captureToolOutcome = () => {};
    orchestrator._handleToolRequirement = async () => false;
    orchestrator._applySelfHealing = async () => {};
    orchestrator.dispatchTool = async () => ({
        ok: true,
        action: 'open',
        page: { url: 'https://example.com/cookie-policy', title: 'Cookie Policy | Example' }
    });
    orchestrator.tools.browserAction = async (args) => {
        if (args.action === 'getMarkdown') return 'Cookie Policy | Example';
        return [];
    };

    await TurnHandlers.executeToolTurn(orchestrator, {
        text: '',
        toolCall: { name: 'browserAction', args: { action: 'open', url: 'https://example.com/p/1' } },
        provider: 'TestProvider',
        model: 'test-model',
        parts: []
    });

    assert.ok(orchestrator.context.some((item) => item.role === 'user' && /Do not use searchWeb/i.test(String(item.content || ''))));
    assert.ok(orchestrator.context.some((item) => item.role === 'user' && /Do NOT call browserAction open on the same URL again/i.test(String(item.content || ''))));
    assert.ok(updates.some((event) => /cookie\/policy page/i.test(String(event.message || ''))));
    console.log('PASS browser first mission corrections');
}

async function testLoopFinalizerExtraction() {
    console.log('--- Testing Loop Finalizer Extraction ---');
    const updates = [];
    const orchestrator = new NexusOrchestrator((event) => updates.push(event));
    let closed = false;
    orchestrator._finishRun = () => {};
    orchestrator.browserInstance.close = async () => { closed = true; };
    orchestrator.currentRun = { toolsUsed: { browserAction: 1 } };
    orchestrator.context.push({ role: 'user', content: 'close browser after task' });

    const result = await LoopFinalizer.finalizeExecuteLoop(orchestrator, {
        isTaskCompleted: false,
        originalRequest: 'close browser after task'
    });

    assert.strictEqual(result.closedBrowser, true);
    assert.strictEqual(closed, true);
    assert.ok(updates.some((event) => String(event.message || '').includes('Auto-closing browser')));
    console.log('PASS loop finalizer extraction');
}

function testMissionStateRuntimeExtraction() {
    console.log('--- Testing Mission State Runtime Extraction ---');
    const defaults = MissionStateRuntime.buildDefaultMissionState();
    assert.strictEqual(defaults.activeMissionDomain, 'general');
    assert.deepStrictEqual(defaults.missionArtifactHistory, []);

    const orchestrator = new NexusOrchestrator();
    orchestrator.pendingApproval = { tool: 'sendEmail' };
    orchestrator.pendingRepair = { tool: 'browserAction' };
    orchestrator.pendingRequirement = { key: 'META_ACCESS_TOKEN' };
    orchestrator.stop();
    assert.strictEqual(orchestrator.pendingApproval, null);
    assert.strictEqual(orchestrator.pendingRepair, null);
    assert.strictEqual(orchestrator.pendingRequirement, null);

    const persisted = orchestrator.getPersistentState();
    const clone = new NexusOrchestrator();
    clone.restorePersistentState(persisted);
    assert.strictEqual(clone.activeMissionDomain, persisted.activeMissionDomain);

    const resetTarget = new NexusOrchestrator();
    resetTarget.currentMissionArtifact = { kind: 'image' };
    resetTarget.reset();
    assert.strictEqual(resetTarget.currentMissionArtifact, null);
    assert.strictEqual(resetTarget.activeMissionDomain, 'general');
    console.log('PASS mission state runtime extraction');
}

function testBrowserMissionPolicyExtraction() {
    console.log('--- Testing Browser Mission Policy Extraction ---');
    assert.strictEqual(BrowserMissionPolicy.isBrowserMissionRequest('open this website and submit the form'), true);
    assert.strictEqual(
        BrowserMissionPolicy.shouldForceBrowserContinuation({
            originalRequest: 'open quiz page and answer',
            contractObjective: '',
            latestUser: '',
            browserToolUsed: false
        }),
        true
    );
    assert.strictEqual(
        BrowserMissionPolicy.isBrowserHesitationResponse('I do not have the inherent knowledge to give correct answers.'),
        true
    );
    assert.ok(
        BrowserMissionPolicy.buildNarratedActionCorrection({
            userRequest: 'open https://example.com and fill the form',
            domain: 'browser',
            shouldForceBrowser: true,
            targetUrl: 'https://example.com',
            isMetaOrganicImageRequest: false
        }).includes('browserAction')
    );
    assert.strictEqual(
        BrowserMissionPolicy.extractBrowserBlockerReason('{"blocker":"otp_required"}'),
        'OTP / verification code is required to continue.'
    );
    console.log('PASS browser mission policy extraction');
}

function testMissionStatusModuleExtraction() {
    console.log('--- Testing Mission Status Module Extraction ---');
    const status = MissionStatus.buildMissionStatusRecord('routing', 'Mission mode locked.', { tool: 'browserAction' }, { mode: 'execute', domain: 'browser' });
    assert.ok(status.signature);
    assert.strictEqual(status.phase, 'routing');
    assert.strictEqual(status.mode, 'execute');
    assert.strictEqual(status.domain, 'browser');
    assert.ok(/Mission Status:/i.test(status.message));
    console.log('PASS mission status module extraction');
}

function testMissionGuardsModuleExtraction() {
    console.log('--- Testing Mission Guards Module Extraction ---');
    const completion = MissionGuards.canDeclareTaskComplete('Task complete', {
        contract: { expectedDeliverable: 'quote' },
        artifact: { kind: 'quote_bundle', files: { pdf: 'quote.pdf' } },
        latestTarget: null,
        currentRun: {},
        shouldForceBrowserContinuation: false
    });
    assert.strictEqual(completion, true);
    assert.strictEqual(MissionGuards.normalizeClarificationQuestion(' What exact email   address should I use? '), 'what exact email address should i use?');
    assert.strictEqual(MissionGuards.extractClarificationQuestion('I need your input.\nWhat exact email address should I use?'), 'What exact email address should I use?');
    assert.strictEqual(
        MissionGuards.shouldAskClarification('What exact email address should I use?', { normalized: 'what exact email address should i use?' }).allow,
        false
    );
    console.log('PASS mission guards module extraction');
}

function testToolEvidenceRuntimeExtraction() {
    console.log('--- Testing Tool Evidence Runtime Extraction ---');
    const quoteEvidence = ToolEvidenceRuntime.classifyDeliverableEvidence({
        contract: { expectedDeliverable: 'quote bundle' },
        artifact: { kind: 'quote_bundle', files: { pdf: 'quote.pdf' } }
    });
    assert.strictEqual(quoteEvidence.hasEvidence, true);

    const emailEvidence = ToolEvidenceRuntime.classifyDeliverableEvidence({
        contract: { expectedDeliverable: 'email' },
        latestTarget: { channel: 'email' }
    });
    assert.strictEqual(emailEvidence.hasEvidence, true);

    const imagePlan = ToolEvidenceRuntime.extractToolOutcomePlan({
        toolCall: { name: 'generateImage', args: { prompt: 'banner', savePath: 'D:/repo/banner.png', aspectRatio: '1:1' } },
        result: 'Success: Image saved to D:/repo/banner.png',
        formatToolResult: (value) => String(value),
        pendingActionChain: [{ type: 'publish_generated_asset', status: 'pending_confirmation' }]
    });
    assert.strictEqual(imagePlan.artifact.kind, 'image');
    assert.strictEqual(imagePlan.queueUpdate.type, 'await_boss');

    const publishPlan = ToolEvidenceRuntime.extractToolOutcomePlan({
        toolCall: { name: 'metaAds', args: { action: 'publishOrganicPhoto', message: 'Fresh pickle launch', imagePath: 'D:/repo/banner.png' } },
        result: { id: 'post_123', surfaces: { facebook: { id: 'post_123' } } },
        formatToolResult: (value) => JSON.stringify(value),
        pendingActionChain: [{ type: 'promote_generated_asset', status: 'approved' }]
    });
    assert.strictEqual(publishPlan.artifact.kind, 'content');
    assert.strictEqual(publishPlan.target.channel, 'meta');
    assert.strictEqual(publishPlan.queueUpdate.type, 'consume_first');
    console.log('PASS tool evidence runtime extraction');
}

function testCreativePromptRuntimeExtraction() {
    console.log('--- Testing Creative Prompt Runtime Extraction ---');
    const imagePrompt = CreativePromptRuntime.enrichCreativePrompt('image', 'generate a image for saying that happy bakrid');
    assert.ok(/polished social media greeting image/i.test(imagePrompt));
    assert.ok(/happy bakrid/i.test(imagePrompt));
    assert.ok(/readable/i.test(imagePrompt));

    const videoPrompt = CreativePromptRuntime.enrichCreativePrompt('video', 'make a promo video with the text Fresh Chicken Pickle');
    assert.ok(/polished social media video/i.test(videoPrompt));
    assert.ok(/Fresh Chicken Pickle/i.test(videoPrompt));
    console.log('PASS creative prompt runtime extraction');
}

function testPreflightPlanRuntimeExtraction() {
    console.log('--- Testing Preflight Plan Runtime Extraction ---');
    const browserPlan = PreflightPlanRuntime.buildPreflightMessage('browser', 'open a website and login');
    assert.ok(/Preflight plan locked/i.test(browserPlan));
    assert.ok(/Open or inspect the target page/i.test(browserPlan));

    const browserMissing = PreflightPlanRuntime.detectMissingInputs('browser', 'open facebook and login');
    assert.ok(browserMissing.includes('login username/email'));
    assert.ok(browserMissing.includes('login password'));

    const outboundMissing = PreflightPlanRuntime.detectMissingInputs('outbound', 'send email to the client');
    assert.ok(outboundMissing.includes('recipient email address'));
    console.log('PASS preflight plan runtime extraction');
}

function testRuntimeFailureRuntimeExtraction() {
    console.log('--- Testing Runtime Failure Runtime Extraction ---');
    const classification = RuntimeFailureRuntime.classifyRuntimeFailure(new TypeError('String(...).ToLower is not a function'));
    assert.ok(classification);
    assert.strictEqual(classification.type, 'runtime_logic_error');
    const repair = RuntimeFailureRuntime.buildRuntimeRepairRequest({
        classification,
        error: new TypeError('String(...).ToLower is not a function'),
        sourceFile: 'index.js'
    });
    assert.ok(/runtime bug/i.test(repair.preview));
    assert.ok(/Reply YES/i.test(repair.message));
    console.log('PASS runtime failure runtime extraction');
}

function testMissionContinuityModuleExtraction() {
    console.log('--- Testing Mission Continuity Module Extraction ---');
    assert.strictEqual(
        MissionContinuity.isMissionFollowUpRequest({
            text: 'proceed',
            currentMissionArtifact: null,
            lastPublishedTargets: [],
            pendingActionChain: [],
            missionTaskStack: [],
            currentWorkflowState: null,
            currentRun: { toolsUsed: { browserAction: 1 } },
            shouldForceBrowserContinuation: true
        }),
        true
    );
    const augmented = MissionContinuity.augmentFollowUpRequest({
        text: 'use this',
        currentMissionArtifact: { kind: 'image', path: 'D:/repo/banner.png', url: '/outputs/banner.png', files: null },
        lastPublishedTargets: [{ channel: 'meta', id: '123', action: 'publish', details: { url: 'https://example.com/post/123' } }],
        pendingActionChain: [{ type: 'publish_generated_asset', channel: 'meta' }]
    });
    assert.ok(augmented.includes('[FOLLOW-UP MISSION CONTEXT]'));
    assert.strictEqual(MissionContinuity.resolveLatestTargetId([{ channel: 'meta', id: 'abc' }], 'meta'), 'abc');
    const artifactResult = MissionContinuity.registerMissionArtifact({
        currentMissionArtifact: null,
        missionArtifactHistory: [],
        lastUploadedFile: null,
        taskDir: 'D:/nexusOS-LLM-stable/nexusOS-LLM/outputs/demo',
        details: { kind: 'image', path: 'D:/nexusOS-LLM-stable/nexusOS-LLM/outputs/demo/file.png' }
    });
    assert.strictEqual(artifactResult.artifact.kind, 'image');
    assert.ok(artifactResult.artifact.url.includes('/outputs/demo/'));
    console.log('PASS mission continuity module extraction');
}

function testMissionMemoryModuleExtraction() {
    console.log('--- Testing Mission Memory Module Extraction ---');
    const memoryContext = MissionMemory.buildMissionMemoryContext({
        activeMissionDomain: 'marketing',
        currentMissionArtifact: { kind: 'image', path: 'banner.png', url: '/outputs/banner.png', sourceTool: 'generateImage' },
        lastPublishedTargets: [{ channel: 'meta', id: '123', type: 'published_output' }],
        missionTaskStack: [{ domain: 'marketing', label: 'generateImage' }],
        pendingActionChain: [{ type: 'publish_generated_asset', status: 'pending_confirmation' }]
    });
    assert.ok(memoryContext.includes('[MISSION DOMAIN]'));
    assert.strictEqual(MissionMemory.classifyMissionDomain({ name: 'generateImage', args: {} }), 'media');
    assert.strictEqual(MissionMemory.classifyMissionDomain({ name: 'browserAction', args: { action: 'open' } }), 'browser');
    const stackState = MissionMemory.pushMissionTask([], 'general', 'marketing', 'publishOrganicPost');
    assert.strictEqual(stackState.activeMissionDomain, 'marketing');
    assert.strictEqual(stackState.missionTaskStack.length, 1);
    console.log('PASS mission memory module extraction');
}

function testToolDispatchPolicyExtraction() {
    console.log('--- Testing Tool Dispatch Policy Extraction ---');
    const normalized = ToolDispatchPolicy.normalizeToolCall({
        name: 'googleAdsCreateCampaign',
        args: { customerId: '123' }
    });
    assert.strictEqual(normalized.name, 'googleAds');
    assert.strictEqual(normalized.args.action, 'createCampaign');
    const browserAlias = ToolDispatchPolicy.normalizeToolCall({ name: 'click', args: { selector: '#go' } });
    assert.strictEqual(browserAlias.name, 'browserAction');
    assert.strictEqual(browserAlias.args.action, 'click');
    assert.strictEqual(ToolDispatchPolicy.inferToolDomain({ name: 'browserAction', args: { action: 'open' } }), 'browser');
    assert.strictEqual(ToolDispatchPolicy.inferToolDomain({ name: 'generateImage', args: {} }), 'media');
    console.log('PASS tool dispatch policy extraction');
}

function testToolArgumentHydration() {
    console.log('--- Testing Tool Argument Hydration ---');
    const hydratedImage = ToolArgumentHydrator.hydrateToolCall({ name: 'generateImage', args: { prompt: 'banner' } }, {
        taskDir: 'D:/nexusOS-LLM-stable/nexusOS-LLM/outputs/demo',
        rootDir: 'D:/nexusOS-LLM-stable/nexusOS-LLM'
    });
    assert.ok(/generated_image_/i.test(hydratedImage.args.savePath));
    assert.strictEqual(hydratedImage.args.aspectRatio, '1:1');

    const hydratedVideo = ToolArgumentHydrator.hydrateToolCall({ name: 'generateVideo', args: { prompt: 'promo' } }, {
        taskDir: 'D:/nexusOS-LLM-stable/nexusOS-LLM/outputs/demo',
        rootDir: 'D:/nexusOS-LLM-stable/nexusOS-LLM'
    });
    assert.ok(/generated_video_/i.test(hydratedVideo.args.outputPath));

    const hydratedQuote = ToolArgumentHydrator.hydrateToolCall({ name: 'createAgencyQuoteArtifacts', args: { quoteName: 'Acme Quote' } }, {
        latestUser: 'create a quote for 3 banners for 2 months',
        extractCommercialQuoteDefaults: (text) => ({ bannerCount: 3, durationWeeks: 8, notes: text })
    });
    assert.strictEqual(hydratedQuote.args.bannerCount, 3);
    assert.strictEqual(hydratedQuote.args.durationWeeks, 8);

    const hydratedMeta = ToolArgumentHydrator.hydrateToolCall({ name: 'metaAds', args: { action: 'publishOrganicPost' } }, {
        taskObjective: 'promote this youtube video in metaAds organic : https://www.youtube.com/watch?v=rbFMSL2DYCc'
    });
    assert.strictEqual(hydratedMeta.args.link, 'https://www.youtube.com/watch?v=rbFMSL2DYCc');
    assert.strictEqual(hydratedMeta.args.message, 'Watch this video and share your thoughts.');
    assert.deepStrictEqual(hydratedMeta.args.channels, ['facebook']);
    console.log('PASS tool argument hydration');
}

function testSelfHealingRuntimeExtraction() {
    console.log('--- Testing Self-Healing Runtime Extraction ---');
    const history = SelfHealingRuntime.recordSelfHealingEvent([], { name: 'browserAction' }, { type: 'timeout' }, { strategy: 'wait_and_retry' });
    assert.strictEqual(history.length, 1);
    assert.strictEqual(SelfHealingRuntime.mapToolToSourceFile('browserAction'), 'browser.js');
    assert.ok(SelfHealingRuntime.buildBlueprintContext([{ description: 'Fix selector', patch: 'replace selector' }]).includes('PROVEN FIX BLUEPRINTS'));
    assert.ok(SelfHealingRuntime.buildRepairDiagnosticPayload({ blueprintContext: 'ctx', toolSource: 'code', toolFileName: 'browser.js' }).includes('TOOL SOURCE [browser.js]'));
    console.log('PASS self-healing runtime extraction');
}

function testGovernanceRuntimeExtraction() {
    console.log('--- Testing Governance Runtime Extraction ---');
    const pending = GovernanceRuntime.buildPendingApproval(
        { name: 'sendEmail', args: { to: 'a@b.com' } },
        { reason: 'External contact', preview: 'Email preview', details: { type: 'email' } }
    );
    assert.strictEqual(pending.toolCall.name, 'sendEmail');
    assert.ok(GovernanceRuntime.buildApprovalRequestMessage('sendEmail', { reason: 'External contact', preview: 'Email preview' }).includes('Approval required'));
    assert.ok(GovernanceRuntime.buildApprovalPromptMessage(pending).includes('Please reply YES'));
    assert.strictEqual(GovernanceRuntime.buildApprovedCall(pending).args.boss_approved, true);
    console.log('PASS governance runtime extraction');
}

async function testToolExecutionRuntimeExtraction() {
    console.log('--- Testing Tool Execution Runtime Extraction ---');
    let screenshotCalled = false;
    const browserResult = await ToolExecutionRuntime.executeBrowserAction(
        { url: 'https://example.com' },
        {
            browserAction: async (args) => {
                if (args.action === 'annotateAndScreenshot') {
                    screenshotCalled = true;
                    return { ok: true };
                }
                return { ok: true, action: args.action || 'open' };
            },
            taskDir: 'D:/nexusOS-LLM-stable/nexusOS-LLM/outputs/demo',
            onUpdate: () => {}
        }
    );
    assert.strictEqual(browserResult.ok, true);
    assert.strictEqual(screenshotCalled, true);

    const adsResult = await ToolExecutionRuntime.executeAdsAction('metaAds', { action: 'publishOrganicPost' }, {
        runAdsTool: async () => 'unreachable'
    });
    assert.ok(String(adsResult).includes('MISSION BREACH'));

    const genericResult = await ToolExecutionRuntime.executeGenericTool('readFile', { absolutePath: 'x' }, {
        tools: {
            readFile: async () => {
                throw new Error('legacy');
            }
        },
        runLegacyFallback: async (toolName) => `${toolName}:fallback`
    });
    assert.strictEqual(genericResult, 'readFile:fallback');

    const videoResult = await ToolExecutionRuntime.executeMediaAction('generateVideo', {
        prompt: 'Create a short chicken pickle promo'
    }, {
        taskDir: 'D:/nexusOS-LLM-stable/nexusOS-LLM/outputs/demo',
        rootDir: 'D:/nexusOS-LLM-stable/nexusOS-LLM',
        generateVideoWithVeo: async (_prompt, outputPath) => ({ success: true, path: outputPath }),
        generateVideoFromPrompt: async () => ({ error: true }),
        imageToVideo: async () => ({ success: true })
    });
    assert.ok(String(videoResult).includes('generated_video_'));

    const timeoutImageResult = await ToolExecutionRuntime.executeMediaAction('generateImage', {
        prompt: 'banner'
    }, {
        taskDir: 'D:/nexusOS-LLM-stable/nexusOS-LLM/outputs/demo',
        rootDir: 'D:/nexusOS-LLM-stable/nexusOS-LLM',
        mediaTimeoutMs: 5,
        generateImage: async () => new Promise(() => {}),
        recordMediaUsage: async () => {},
        registerMissionArtifact: () => {}
    });
    assert.ok(String(timeoutImageResult).includes('timed out'));
    console.log('PASS tool execution runtime extraction');
}

async function testExternalActionPolicyExtraction() {
    console.log('--- Testing External Action Policy Extraction ---');
    assert.strictEqual(ExternalActionPolicy.isExternalActionConfirmed('sendEmail', {}, 'sent ok'), true);
    assert.strictEqual(ExternalActionPolicy.isExternalActionConfirmed('sendEmail', {}, 'error: failed'), false);
    const preflight = await ExternalActionPolicy.preflightExternalAction(
        { name: 'metaAds', args: { action: 'publishOrganicPost', pageId: 'PAGE123', channels: ['facebook'] } },
        {
            metaAdsTool: { getSetupStatus: async () => ({ hasAccessToken: true, hasAdAccountId: true, hasPageId: false, hasInstagramBusinessAccountId: false }) },
            googleAdsTool: { getSetupStatus: async () => ({}) },
            linkedInAdsTool: { getSetupStatus: async () => ({}) }
        },
        {
            latestUser: 'publish on facebook',
            isCreativeAssetRequest: () => false,
            hasImageArtifact: () => true,
            isPlaceholderValue: () => false
        }
    );
    assert.strictEqual(preflight.ok, false);
    assert.ok(String(preflight.error).includes('META_PAGE_ID'));
    console.log('PASS external action policy extraction');
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
    const mixedContract = orchestrator._buildTaskContract('get product details from this website and promote it in meta ads');

    assert.strictEqual(browserContract.routingProfile.domain, 'browser');
    assert.ok(browserContract.routingProfile.allowedTools.includes('browserAction'));
    assert.strictEqual(codeContract.routingProfile.domain, 'code');
    assert.ok(codeContract.routingProfile.allowedTools.includes('readFile'));
    assert.strictEqual(commercialContract.routingProfile.domain, 'commercial');
    assert.ok(commercialContract.routingProfile.allowedTools.includes('createAgencyQuoteArtifacts'));
    assert.strictEqual(imageContract.routingProfile.domain.includes('image'), true);
    assert.ok(imageContract.routingProfile.allowedTools.includes('generateImage'));
    assert.ok(imageContract.routingProfile.allowedTools.includes('metaAds'));
    assert.strictEqual(imageContract.routingProfile.allowedTools.includes('generateVideo'), false);
    assert.strictEqual(videoContract.routingProfile.domain, 'video');
    assert.ok(videoContract.routingProfile.allowedTools.includes('generateVideo'));
    assert.strictEqual(videoContract.routingProfile.allowedTools.includes('generateImage'), false);
    assert.strictEqual(organicMetaContract.routingProfile.domain.includes('marketing_meta_organic'), true);
    assert.ok(organicMetaContract.routingProfile.allowedTools.includes('generateImage'));
    assert.ok(organicMetaContract.routingProfile.allowedTools.includes('metaAds'));
    assert.ok(mixedContract.routingProfile.allowedTools.includes('browserAction'));
    assert.ok(mixedContract.routingProfile.allowedTools.includes('metaAds'));
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

function testBrowserBlockerDetection() {
    console.log('--- Testing Browser Blocker Detection ---');
    const browserSource = fs.readFileSync(require.resolve('../tools/browser'), 'utf8');
    assert.ok(browserSource.includes('captcha_detected'));
    assert.ok(browserSource.includes('otp_required'));
    assert.ok(browserSource.includes('checkpoint_detected'));
    assert.ok(browserSource.includes('dismissInterruptions'));
    assert.ok(browserSource.includes('transitionChanged'));
    console.log('PASS browser blocker detection');
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
    llm._startGeminiCooldown(5000);
    assert.strictEqual(llm._isGeminiCoolingDown(), true);
    assert.strictEqual(
        DomainPolicy.isToolRelevantToTask({
            toolCall: { name: 'generateImage', args: { prompt: 'banner' } },
            request: 'generate an image banner for a chicken pickle ad and keep the output file available',
            routingProfile: { domain: 'media', allowedTools: ['generateImage', 'generateVideo', 'removeBg'], blockedTools: [] }
        }),
        true
    );
    console.log('PASS provider pinning');
}

function testToolRegistryProfilesAndSummaries() {
    console.log('--- Testing Tool Registry Profiles And Summaries ---');
    const browserProfile = cloneProfile('browser');
    assert.strictEqual(browserProfile.preferredTools.includes('browserAction'), true);
    assert.strictEqual(browserProfile.blockedTools.includes('generateImage'), true);

    const capabilitySummary = buildCapabilitySummary();
    assert.ok(capabilitySummary.includes('Browser automation'));
    assert.ok(capabilitySummary.includes('Creative/media'));

    const metaWaysSummary = buildMetaWaysSummary();
    assert.ok(metaWaysSummary.includes('2 real ways'));
    assert.ok(metaWaysSummary.includes('single post/photo/video/reel'));

    const metaTypesSummary = buildMetaTypesSummary();
    assert.ok(metaTypesSummary.includes('campaign, ad set, creative, ad'));
    assert.ok(metaTypesSummary.includes('Organic publish actions'));
    console.log('PASS tool registry profiles and summaries');
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

    const salvagedVideo = orchestrator._extractToolCallFromNarration(`
    <execute_tool>
    <tool_code>
    print(generateVideo(prompt="Create a spicy chicken pickle promo video"))
    </tool_code>
    </execute_tool>
    `);
    assert.ok(salvagedVideo, 'Narrated video tool text should be salvageable');
    assert.strictEqual(salvagedVideo.name, 'generateVideo');
    assert.ok(/chicken pickle promo video/i.test(salvagedVideo.args.prompt));

    const salvagedQuote = orchestrator._extractToolCallFromNarration(`
    {"tool_code":"print(nexus.createAgencyQuoteArtifacts(quoteName='Monthly Marketing Services Quote', format='PDF'))"}
    `);
    assert.ok(salvagedQuote, 'Narrated quote artifact tool text should be salvageable');
    assert.strictEqual(salvagedQuote.name, 'createAgencyQuoteArtifacts');
    assert.strictEqual(salvagedQuote.args.quoteName, 'Monthly Marketing Services Quote');
    assert.strictEqual(salvagedQuote.args.format, 'PDF');
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

function testNarratedActionCorrections() {
    console.log('--- Testing Narrated Action Corrections ---');
    const orchestrator = new NexusOrchestrator();

    orchestrator.currentTaskContract = orchestrator._buildTaskContract('create a fashion banner image');
    assert.ok(orchestrator._containsNarratedToolSuccess('I have successfully generated the image for you. Here it is: [Image: banner.png]. Task Complete.'));
    assert.ok(orchestrator._buildNarratedActionCorrection('create a fashion banner image').includes('generateImage'));

    orchestrator.currentTaskContract = orchestrator._buildTaskContract('create a promo reel video');
    assert.ok(orchestrator._buildNarratedActionCorrection('create a promo reel video').includes('generateVideo'));

    orchestrator.currentTaskContract = orchestrator._buildTaskContract('create a quote for monthly marketing retainer');
    assert.ok(orchestrator._buildNarratedActionCorrection('create a quote for monthly marketing retainer').includes('buildAgencyQuotePlan'));

    orchestrator.currentTaskContract = orchestrator._buildTaskContract('send email to the client');
    assert.ok(orchestrator._buildNarratedActionCorrection('send email to the client').includes('sendEmail'));

    orchestrator.currentTaskContract = orchestrator._buildTaskContract('fix the bug in index.js');
    assert.ok(orchestrator._buildNarratedActionCorrection('fix the bug in index.js').includes('readFile'));

    orchestrator.currentTaskContract = orchestrator._buildTaskContract('open https://example.com and fill the form');
    assert.ok(orchestrator._buildNarratedActionCorrection('open https://example.com and fill the form').includes('browserAction'));

    console.log('PASS narrated action corrections');
}

function testDeterministicToolCorrection() {
    console.log('--- Testing Deterministic Tool Correction ---');
    const orchestrator = new NexusOrchestrator();
    orchestrator.currentTaskContract = {
        objective: 'generate an image banner for a chicken pickle ad',
        routingProfile: { domain: 'image' }
    };
    assert.ok(orchestrator._buildDeterministicToolCorrection('generate an image banner').includes('generateImage'));

    orchestrator.currentTaskContract = {
        objective: 'create a quote for monthly marketing services',
        routingProfile: { domain: 'commercial' }
    };
    assert.ok(orchestrator._buildDeterministicToolCorrection('create a quote').includes('buildAgencyQuotePlan'));
    orchestrator.currentTaskContract = {
        objective: 'generate a promo video for chicken pickle',
        routingProfile: { domain: 'video' }
    };
    assert.strictEqual(orchestrator._shouldDirectMediaKickoff('generate a promo video for chicken pickle'), true);

    orchestrator.currentTaskContract = {
        objective: 'promote this youtube video in metaAds organic https://www.youtube.com/watch?v=rbFMSL2DYCc',
        routingProfile: { domain: 'marketing' }
    };
    assert.ok(orchestrator._buildDeterministicToolCorrection('promote this youtube video in metaAds organic https://www.youtube.com/watch?v=rbFMSL2DYCc').includes('publishOrganicPost'));
    console.log('PASS deterministic tool correction');
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

function testBrowserBlockerReasonExtraction() {
    console.log('--- Testing Browser Blocker Reason Extraction ---');
    const orchestrator = new NexusOrchestrator();
    assert.strictEqual(
        orchestrator._extractBrowserBlockerReason('{"blocker":"captcha_detected"}'),
        'CAPTCHA detected on the page. Human help is required.'
    );
    assert.strictEqual(
        orchestrator._extractBrowserBlockerReason('{"blocker":"otp_required"}'),
        'OTP / verification code is required to continue.'
    );
    console.log('PASS browser blocker reason extraction');
}

function testCapabilityResponses() {
    console.log('--- Testing Capability Responses ---');
    const orchestrator = new NexusOrchestrator();
    assert.strictEqual(orchestrator._isCapabilityQuestion('explain me all of your skills'), true);
    const metaWays = orchestrator._buildCapabilityResponse('how many ways u can do metaads');
    assert.ok(/2 real ways/i.test(metaWays));
    const adTypes = orchestrator._buildCapabilityResponse('what types ads u can do on meta');
    assert.ok(/should not claim full support/i.test(adTypes));
    console.log('PASS capability responses');
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
    assert.ok(formatted[1].parts.some((part) => part.function_call), 'Function call should still be preserved');
    assert.ok(formatted[2].parts.some((part) => part.function_response), 'Function response should use Gemini request snake_case');
    console.log('PASS Gemini formatting guard');
}

function testBrowserToolDefinitionIncludesDismissInterruptions() {
    console.log('--- Testing Browser Tool Definition Includes Dismiss Interruptions ---');
    const llm = new LLMService();
    const browserTool = llm.getToolDefinitions('execute').find((tool) => tool.name === 'browserAction');
    assert.ok(browserTool);
    assert.ok(browserTool.parameters.properties.action.enum.includes('dismissInterruptions'));
    assert.ok(browserTool.parameters.properties.action.enum.includes('fillByLabel'));
    assert.ok(browserTool.parameters.properties.label);
    console.log('PASS browser dismiss interruptions tool definition');
}

function testBrowserTransitionFingerprint() {
    console.log('--- Testing Browser Transition Fingerprint ---');
    const browser = new BrowserTool();
    const before = { url: 'https://example.com', title: 'Home', bodyTextPreview: 'Welcome home' };
    const after = { url: 'https://example.com/login', title: 'Login', bodyTextPreview: 'Please sign in' };
    const payload = browser._withTransition(before, after, { ok: true, action: 'click' });
    assert.strictEqual(payload.transitionChanged, true);
    assert.deepStrictEqual(payload.pageBefore, before);
    assert.deepStrictEqual(payload.page, after);
    console.log('PASS browser transition fingerprint');
}

function testBrowserLabelFillSupport() {
    console.log('--- Testing Browser Label Fill Support ---');
    const browserSource = fs.readFileSync(require.resolve('../tools/browser'), 'utf8');
    assert.ok(browserSource.includes('_fillFieldByLabel'));
    assert.ok(browserSource.includes("case 'fillByLabel'"));
    assert.ok(browserSource.includes('_findElementAcrossFrames'));
    assert.ok(browserSource.includes('_findElementInShadow'));
    assert.ok(browserSource.includes('shadowRoot'));
    assert.ok(browserSource.includes('this.page.frames()'));
    assert.ok(browserSource.includes('_waitForPageSettled'));
    assert.ok(browserSource.includes('for (const frame of this._getAllFrames())'));
    console.log('PASS browser label fill support');
}

async function testSquadAgentToolRestriction() {
    console.log('--- Testing Squad Agent Tool Restriction ---');
    const profile = SquadSystem.getAgentProfile('designer');
    assert.ok(profile);
    assert.deepStrictEqual(profile.tools, ['generateImage', 'removeBg']);

    const originalGenerate = SquadSystem.llmService.generateResponse;
    let capturedOptions = null;
    SquadSystem.llmService.generateResponse = async (_messages, options = {}) => {
        capturedOptions = options;
        return { text: 'ok', toolCall: null, provider: 'Mock', model: 'Mock' };
    };

    try {
        await SquadSystem.delegate('designer', 'Create a banner');
        assert.ok(capturedOptions, 'Squad delegate should forward LLM options');
        assert.deepStrictEqual(capturedOptions.allowedTools, ['generateImage', 'removeBg']);
        assert.strictEqual(capturedOptions.mode, 'execute');
    } finally {
        SquadSystem.llmService.generateResponse = originalGenerate;
    }

    console.log('PASS squad agent tool restriction');
}

async function run() {
    testMissionModeRouting();
    testTaskContract();
    testContextHygieneGuards();
    testDomainPolicyExtraction();
    testCapabilityModuleExtraction();
    testTaskContractModuleExtraction();
    await testQueryEngineBootstrapExtraction();
    await testQueryEnginePreflightPause();
      await testUnhandledRuntimeErrorPause();
      await testMetaRequirementDetection();
      testRequirementRuntimeExtraction();
      await testDirectOrganicMetaKickoff();
      testManualProductPromotionDraftExtraction();
      await testMixedProductPromotionSkipsDirectOrganicKickoff();
      await testSingleKeyRequirementColonParsing();
      await testTransientAssetRequirementUrlHandling();
      await testQueryEngineLoopDelegation();
      await testQueryTurnRuntimeExtraction();
      await testTurnHandlersExtraction();
      await testBrowserFirstMissionCorrections();
      await testLoopFinalizerExtraction();
    testMissionStateRuntimeExtraction();
    testBrowserMissionPolicyExtraction();
    testMissionStatusModuleExtraction();
    testMissionGuardsModuleExtraction();
    testToolEvidenceRuntimeExtraction();
    testCreativePromptRuntimeExtraction();
    testPreflightPlanRuntimeExtraction();
    testRuntimeFailureRuntimeExtraction();
    testMissionContinuityModuleExtraction();
    testMissionMemoryModuleExtraction();
    testToolDispatchPolicyExtraction();
    testToolArgumentHydration();
    testGovernanceRuntimeExtraction();
    testSelfHealingRuntimeExtraction();
    await testToolExecutionRuntimeExtraction();
    await testExternalActionPolicyExtraction();
    testTaskRoutingProfile();
    testToolRelevanceGuard();
    testCompletionEvidence();
    testClarificationDeduping();
    testBrowserContinuationGuard();
    testBrowserToolAssignment();
    testCodeToolAssignment();
    testBrowserFollowUpAndCompletionEvidence();
    testBrowserSelectorNormalization();
testBrowserBlockerDetection();
testProviderPinning();
testToolRegistryProfilesAndSummaries();
testNarratedToolSalvage();
testUrlExtraction();
testWeakBrowserTextTurnDetection();
testNarratedActionCorrections();
testDeterministicToolCorrection();
testMetaOrganicImageDetection();
    testBrowserBlockerReasonExtraction();
    testCapabilityResponses();
    testGeminiFormattingSkipsNonStringAssistantContent();
    testBrowserToolDefinitionIncludesDismissInterruptions();
    testBrowserTransitionFingerprint();
    testBrowserLabelFillSupport();
    await testSquadAgentToolRestriction();
    console.log('--- Nexus Regression Guards Passed ---');
}

run().catch((err) => {
    console.error('❌ Regression test failed:', err);
    process.exit(1);
});
