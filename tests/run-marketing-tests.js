const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const MarketingService = require('../core/marketing');
const MarketingPrompts = require('../core/marketingPrompts');
const MarketingTemplates = require('../core/marketingTemplates');
const MarketingUtils = require('../tools/marketingUtils');
const GoalInterpreter = require('../core/goalInterpreter');
const SetupPlaybooks = require('../core/setupPlaybooks');
const SetupDoctor = require('../core/setupDoctor');
const MissionMode = require('../core/missionMode');
const SelfHealing = require('../core/selfHealing');
const NexusOrchestrator = require('../index');
const LLMService = require('../core/llm');

function run(name, fn) {
    try {
        fn();
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}`);
        console.error(error);
        process.exitCode = 1;
    }
}

run('workflow detection recognizes audit prompts', () => {
    const workflow = MarketingService.detectWorkflowFromText('MARKETING WORKFLOW: Marketing Audit\nPlease audit this landing page.');
    assert.equal(workflow.id, 'audit');
});

run('audit bundle includes required scorecard sections', () => {
    const specialists = Object.entries(MarketingPrompts.getAuditSpecialists()).map(([id, item]) => ({ id, ...item }));
    const bundle = MarketingService.buildAuditBundle({
        target: 'https://example.com',
        clientName: 'Acme',
        notes: 'Improve conversions',
        budget: '$2000',
        channels: ['Meta Ads'],
        specialists
    });
    assert.match(bundle, /SPECIALIST AUDIT SCORECARD/);
    assert.match(bundle, /30-day action plan/);
});

run('audit prompt context contains multi-specialist mode', () => {
    const workflow = MarketingService.getWorkflow('audit');
    const text = MarketingPrompts.buildAuditBundleContext({
        workflow,
        target: 'https://example.com',
        clientName: 'Acme',
        notes: 'B2B SaaS',
        budget: '$1200',
        channels: ['LinkedIn']
    });
    assert.match(text, /MULTI-SPECIALIST AUDIT MODE/);
    assert.match(text, /Content Analyst/);
    assert.match(text, /Growth Strategist/);
});

run('ads execution context keeps zero-budget organic briefs organic', () => {
    const text = MarketingPrompts.buildAdsExecutionContext(`
MARKETING WORKFLOW: Ad Strategy Pack
Primary channels: Meta ads Facebook and Instagram.
Indicative working budget: 0.
Extra notes: promote this in meta ads facebook and instagram organic
`);
    assert.match(text, /ORGANIC META PROMOTION plan/i);
    assert.match(text, /Do not invent paid budget allocation/i);
    assert.match(text, /Facebook Page and Instagram organic content/i);
});

run('marketing utils produce structured page analysis', () => {
    const result = MarketingUtils.analyzePage({
        target: 'https://example.com/pricing',
        notes: 'Book a demo CTA and pricing intent',
        channels: ['Google Ads']
    });
    assert.equal(result.ok, true);
    assert.equal(result.type, 'page_analysis');
    assert.ok(Array.isArray(result.findings));
    assert.ok(result.findings.length >= 4);
});

run('marketing utils produce competitor scan rows', () => {
    const result = MarketingUtils.scanCompetitors({
        target: 'example.com',
        competitors: ['competitor-a.com', 'competitor-b.com'],
        notes: 'Compare offers'
    });
    assert.equal(result.ok, true);
    assert.equal(result.competitorCount, 2);
    assert.equal(result.rows.length, 2);
});

run('marketing utils produce social calendar posts', () => {
    const result = MarketingUtils.generateSocialCalendar({
        target: 'Spring launch',
        channels: ['Instagram', 'LinkedIn'],
        weeks: 3,
        theme: 'Offer push'
    });
    assert.equal(result.ok, true);
    assert.equal(result.weeks, 3);
    assert.equal(result.posts.length, 3);
});

run('marketing templates write markdown and pdf files', () => {
    const outputsRoot = path.join(__dirname, 'tmp-outputs');
    fs.rmSync(outputsRoot, { recursive: true, force: true });

    const markdown = MarketingTemplates.buildReportMarkdown({
        clientName: 'Acme',
        workflowLabel: 'Marketing Audit',
        target: 'https://example.com',
        notes: 'Focus on revenue',
        promptPack: MarketingPrompts.getPromptPack('audit'),
        brief: 'Audit the full funnel.'
    });
    const written = MarketingTemplates.writeMarketingFile({
        outputsRoot,
        clientId: 'client-1',
        type: 'report',
        baseName: 'marketing-audit-acme',
        content: markdown
    });
    const pdf = MarketingTemplates.buildMarketingPdfBuffer({
        clientName: 'Acme',
        workflowLabel: 'Marketing Audit',
        target: 'https://example.com',
        notes: 'Focus on revenue',
        brief: 'Audit the full funnel.',
        type: 'report'
    });
    const pdfWritten = MarketingTemplates.writeMarketingPdf({
        outputsRoot,
        clientId: 'client-1',
        baseName: 'marketing-audit-acme',
        pdfBuffer: pdf
    });

    assert.equal(fs.existsSync(written.absolutePath), true);
    assert.equal(fs.existsSync(pdfWritten.absolutePath), true);
    assert.match(fs.readFileSync(written.absolutePath, 'utf8'), /Executive Summary/);

    fs.rmSync(outputsRoot, { recursive: true, force: true });
});

run('goal interpreter detects simple follower goals', () => {
    const goal = GoalInterpreter.interpretGoal('I need 100 followers for this page.');
    assert.equal(goal.metric, 'followers');
    assert.equal(goal.targetValue, 100);
    assert.deepEqual(goal.channels, ['Meta', 'Instagram']);
});

run('goal interpreter builds execution brief for order goals', () => {
    const goal = GoalInterpreter.interpretGoal('Get me at least 5 orders from this product page.');
    const brief = GoalInterpreter.buildExecutionBrief(goal);
    assert.match(brief, /Deliver 5 orders/i);
    assert.match(brief, /Prioritize conversion strategy/i);
    assert.match(brief, /Website, Meta, WhatsApp/i);
});

run('mission mode treats browser quiz tasks as plan mode', () => {
    const mode = MissionMode.detectMissionMode('open this quiz website, read all questions and submit the form');
    assert.equal(mode, 'plan');
});

run('self-healing classifies selector-less browser extraction as browser mismatch', () => {
    const classification = SelfHealing.classify(
        { name: 'browserAction', args: { action: 'extract' } },
        'Error: action=extract requires selector'
    );
    assert.equal(classification.type, 'browser_mismatch');
});

run('organic meta publish validation blocks null placeholder payloads', () => {
    const orchestrator = new NexusOrchestrator();
    const error = orchestrator._validateMetaOrganicArgs({
        action: 'publishOrganicPost',
        pageId: 'null',
        message: 'null',
        imagePath: 'null',
        link: 'null'
    });
    assert.match(error, /missing required fields/i);
    assert.match(error, /pageId/i);
    assert.match(error, /message/i);
});

run('organic meta draft extractor captures prepared promo payload', () => {
    const orchestrator = new NexusOrchestrator();
    const draft = orchestrator._extractOrganicMetaDraft(`
Here's the prepared content for your Facebook and Instagram promotion:

**Title:** Starting at Just Rs.99! Grab Your Style Steals Today!

**Description:**
Discover incredible fashion that won't break the bank!

**Call to Action:** Shop Now & Save Big!
**Link:** https://mkfashion.in/p/G9SUj2Rv4x

**Image:** https://example.com/product.jpg

**Tags/Hashtags:**
#MKFashion #AffordableFashion
`);
    assert.equal(draft.channel, 'meta_organic');
    assert.match(draft.message, /Starting at Just Rs\.99/i);
    assert.equal(draft.link, 'https://mkfashion.in/p/G9SUj2Rv4x');
    assert.equal(draft.imagePath, 'https://example.com/product.jpg');
});

run('commercial quote detector ignores organic meta publish prompts', () => {
    const orchestrator = new NexusOrchestrator();
    const result = orchestrator._detectCommercialQuoteRequest(`
Publish an ORGANIC Facebook and Instagram Meta post for this product.
Budget: 0
Promotion type: ORGANIC only
Do not create a quote plan.
Do not create paid ads.
Do not ask for campaign ID, ad set ID, or creative ID.
`);
    assert.equal(result, false);
});

run('organic publish requests trigger auto approval handoff', () => {
    const orchestrator = new NexusOrchestrator();
    const shouldAutoApprove = orchestrator._shouldAutoRequestOrganicApproval(
        `Publish an ORGANIC Facebook and Instagram Meta post for this product.
         Then ask for approval.
         After I reply YES, publish it.`,
        `Please let me know if you approve this content for publishing. Once approved, I will generate the final file with the Meta payload.`
    );
    assert.equal(shouldAutoApprove, true);
});

run('workflow state enters quote planning for quote requests', () => {
    const orchestrator = new NexusOrchestrator();
    orchestrator._applyWorkflowIntent('Create a quote plan for Meta Ads for this client');
    assert.equal(orchestrator.currentWorkflowState.mode, 'quote');
    assert.equal(orchestrator.currentWorkflowState.stage, 'planning');
});

run('workflow state enters organic publish flow for promote requests', () => {
    const orchestrator = new NexusOrchestrator();
    orchestrator._applyWorkflowIntent('promote it on facebook and instagram organic');
    assert.equal(orchestrator.currentWorkflowState.mode, 'organic_publish');
});

run('meta publish success detector requires actual api success payload', () => {
    const orchestrator = new NexusOrchestrator();
    assert.equal(orchestrator._isSuccessfulMetaPublishResult({ id: '12345' }), true);
    assert.equal(orchestrator._isSuccessfulMetaPublishResult({ success: true }), true);
    assert.equal(orchestrator._isSuccessfulMetaPublishResult({ error: 'failed' }), false);
    assert.equal(orchestrator._isSuccessfulMetaPublishResult({}), false);
});

run('meta tool normalization extracts organic payload from body json', () => {
    const orchestrator = new NexusOrchestrator();
    const normalized = orchestrator._normalizeToolCall({
        name: 'metaAds',
        args: {
            action: 'publishOrganicPost',
            pageId: 'PAGE_ID',
            body: JSON.stringify({
                media_url: 'https://example.com/product.jpg',
                message: 'Hello world',
                call_to_action: { type: 'SHOP_NOW', link: 'https://example.com' },
                title: 'Example title'
            })
        }
    });
    assert.equal(normalized.args.message, 'Hello world');
    assert.equal(normalized.args.link, 'https://example.com');
    assert.equal(normalized.args.imagePath, 'https://example.com/product.jpg');
    assert.equal(normalized.args.cta, 'SHOP_NOW');
    assert.equal(normalized.args.title, 'Example title');
});

run('meta auth error detector recognizes expired token response', () => {
    const orchestrator = new NexusOrchestrator();
    assert.equal(orchestrator._isMetaAuthError({
        error: 'Error validating access token',
        details: { code: 190, error_subcode: 463 }
    }), true);
});

run('plan mode openrouter models prefer free planning order', () => {
    const llm = new LLMService();
    assert.deepEqual(llm.getPlanOpenRouterModels(), [
        'openai/gpt-oss-20b:free',
        'openai/gpt-oss-120b:free',
        'google/gemma-3-27b-it:free',
        'google/gemma-3-12b-it:free'
    ]);
});

run('setup playbooks expose deterministic provider setup for tavily and groq', () => {
    const tavily = SetupPlaybooks.getPlaybook('TAVILY_API_KEY');
    const groq = SetupPlaybooks.getPlaybook('GROQ_API_KEY');
    assert.equal(tavily.provider, 'Tavily');
    assert.match(tavily.setupPrompt, /Open Tavily/i);
    assert.equal(groq.provider, 'Groq');
    assert.match(groq.setupPrompt, /Groq/i);
});

run('setup doctor flags missing search providers for research tasks', () => {
    const report = SetupDoctor.buildSetupDoctor({
        has: () => false,
        firestoreReady: true,
        prompt: 'Research this competitor and search the web for latest information'
    });
    assert.equal(report.summary.ready, false);
    assert.ok(report.blockers.some((item) => item.code === 'search'));
});

run('setup doctor flags missing meta config for meta publishing tasks', () => {
    const configured = new Set(['META_ACCESS_TOKEN']);
    const report = SetupDoctor.buildSetupDoctor({
        has: (key) => configured.has(key),
        firestoreReady: true,
        prompt: 'Publish this on Meta ads for the client'
    });
    assert.ok(report.blockers.some((item) => item.code === 'meta_ads'));
});

if (process.exitCode) {
    process.exit(process.exitCode);
}
