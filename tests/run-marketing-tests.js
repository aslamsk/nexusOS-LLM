const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const MarketingService = require('../core/marketing');
const MarketingPrompts = require('../core/marketingPrompts');
const MarketingTemplates = require('../core/marketingTemplates');
const MarketingUtils = require('../tools/marketingUtils');
const GoalInterpreter = require('../core/goalInterpreter');

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

if (process.exitCode) {
    process.exit(process.exitCode);
}
