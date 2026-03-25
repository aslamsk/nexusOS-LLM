const WORKFLOWS = {
    audit: {
        id: 'audit',
        label: 'Marketing Audit',
        category: 'analysis',
        output: 'MARKETING-AUDIT.md',
        specialists: ['content', 'conversion', 'competitive', 'technical', 'strategy'],
        description: 'Full-funnel website audit with scoring, quick wins, strategic recommendations, and revenue impact.'
    },
    copy: {
        id: 'copy',
        label: 'Copy Optimizer',
        category: 'content',
        output: 'COPY-SUGGESTIONS.md',
        specialists: ['content', 'conversion'],
        description: 'Before/after copy recommendations for headlines, CTAs, offers, and landing page sections.'
    },
    emails: {
        id: 'emails',
        label: 'Email Sequence',
        category: 'content',
        output: 'EMAIL-SEQUENCES.md',
        specialists: ['content', 'strategy'],
        description: 'Generate nurture, launch, onboarding, or conversion-oriented email sequences.'
    },
    social: {
        id: 'social',
        label: 'Social Calendar',
        category: 'content',
        output: 'SOCIAL-CALENDAR.md',
        specialists: ['content', 'strategy'],
        description: 'Create a multi-week content calendar with hooks, formats, and campaign angles.'
    },
    ads: {
        id: 'ads',
        label: 'Ad Strategy Pack',
        category: 'campaigns',
        output: 'AD-CAMPAIGNS.md',
        specialists: ['conversion', 'competitive', 'strategy'],
        description: 'Prepare campaign angle, audience, offer, creative direction, and ad copy for Meta, Google, and LinkedIn.'
    },
    funnel: {
        id: 'funnel',
        label: 'Funnel Analysis',
        category: 'analysis',
        output: 'FUNNEL-ANALYSIS.md',
        specialists: ['conversion', 'strategy'],
        description: 'Analyze acquisition-to-conversion flow, friction, drop-off points, and upsell opportunities.'
    },
    competitors: {
        id: 'competitors',
        label: 'Competitor Report',
        category: 'analysis',
        output: 'COMPETITOR-REPORT.md',
        specialists: ['competitive', 'strategy'],
        description: 'Positioning, alternatives, offer gaps, messaging comparison, and opportunity map.'
    },
    landing: {
        id: 'landing',
        label: 'Landing Page CRO',
        category: 'conversion',
        output: 'LANDING-CRO.md',
        specialists: ['content', 'conversion'],
        description: 'Section-by-section landing page analysis with conversion recommendations.'
    },
    launch: {
        id: 'launch',
        label: 'Launch Playbook',
        category: 'strategy',
        output: 'LAUNCH-PLAYBOOK.md',
        specialists: ['content', 'strategy'],
        description: 'Plan messaging, email, social, offer timing, and launch execution checklist.'
    },
    proposal: {
        id: 'proposal',
        label: 'Client Proposal',
        category: 'client',
        output: 'CLIENT-PROPOSAL.md',
        specialists: ['strategy'],
        description: 'Generate a client-facing proposal based on goals, scope, deliverables, and expected outcomes.'
    },
    report: {
        id: 'report',
        label: 'Client Report',
        category: 'client',
        output: 'MARKETING-REPORT.md',
        specialists: ['content', 'conversion', 'strategy'],
        description: 'Create a client-ready marketing report with findings, priorities, and recommendations.'
    },
    seo: {
        id: 'seo',
        label: 'SEO Audit',
        category: 'analysis',
        output: 'SEO-AUDIT.md',
        specialists: ['technical', 'content'],
        description: 'SEO structure, discoverability, on-page content gaps, and content opportunity mapping.'
    },
    brand: {
        id: 'brand',
        label: 'Brand Voice',
        category: 'strategy',
        output: 'BRAND-VOICE.md',
        specialists: ['content', 'strategy'],
        description: 'Define brand tone, promise, trust signals, and message consistency guidance.'
    }
};

function normalizeWorkflow(id) {
    return WORKFLOWS[id] || null;
}

function detectWorkflowFromText(text) {
    const value = String(text || '');
    if (!value.trim()) return null;

    const explicitHeader = value.match(/MARKETING WORKFLOW:\s*(.+)/i);
    if (explicitHeader) {
        const normalizedHeader = explicitHeader[1].trim().toLowerCase();
        const byHeader = Object.values(WORKFLOWS).find((workflow) => workflow.label.toLowerCase() === normalizedHeader || workflow.id === normalizedHeader);
        if (byHeader) return byHeader;
    }

    const lowered = value.toLowerCase();
    return Object.values(WORKFLOWS).find((workflow) => {
        const label = workflow.label.toLowerCase();
        return lowered.includes(`marketing workflow: ${workflow.id}`) ||
            lowered.includes(`marketing workflow: ${label}`) ||
            lowered.includes(`workflow selected: ${label}`) ||
            lowered.includes(`workflow selected: ${workflow.id}`) ||
            lowered.includes(`marketing ${workflow.id}`) ||
            lowered.includes(label);
    }) || null;
}

function buildMissionBrief({ workflowId, target, clientName, notes, budget, channels }) {
    const workflow = normalizeWorkflow(workflowId);
    if (!workflow) throw new Error(`Unknown marketing workflow: ${workflowId}`);

    const channelLine = channels?.length ? `Primary channels: ${channels.join(', ')}.` : '';
    const budgetLine = budget ? `Indicative working budget: ${budget}.` : '';
    const noteLine = notes ? `Extra notes: ${notes}` : '';

    return [
        `MARKETING WORKFLOW: ${workflow.label}`,
        `Objective: ${workflow.description}`,
        target ? `Primary target: ${target}` : '',
        clientName ? `Client: ${clientName}` : '',
        channelLine,
        budgetLine,
        noteLine,
        '',
        'Execution instructions:',
        '- Keep the current Nexus OS operating flow intact.',
        '- Use existing tools for browser research, search, files, ads, email, and report generation when useful.',
        `- Think like these specialist perspectives: ${workflow.specialists.join(', ')}.`,
        '- Produce a client-ready deliverable with prioritized recommendations.',
        '- Tie recommendations to likely business impact and revenue where possible.',
        '- Keep outputs implementation-ready, not generic.',
        '',
        `Expected output artifact: ${workflow.output}`
    ].filter(Boolean).join('\n');
}

function buildAuditBundle({ target, clientName, notes, budget, channels, specialists = [] }) {
    const workflow = normalizeWorkflow('audit');
    const scores = specialists.map((specialist) => `- ${specialist.label}: score __/10 | biggest risk | fastest win`);
    const channelLine = channels?.length ? `Channels in play: ${channels.join(', ')}.` : '';
    return [
        `MARKETING WORKFLOW: ${workflow.label}`,
        `Objective: ${workflow.description}`,
        target ? `Primary target: ${target}` : '',
        clientName ? `Client: ${clientName}` : '',
        channelLine,
        budget ? `Working budget: ${budget}` : '',
        notes ? `Client notes: ${notes}` : '',
        '',
        'SPECIALIST AUDIT SCORECARD',
        ...scores,
        '',
        'Required final sections:',
        '1. Executive summary',
        '2. Content findings',
        '3. Conversion findings',
        '4. Competitive findings',
        '5. Technical / SEO findings',
        '6. Strategy findings',
        '7. Top 5 priorities',
        '8. 30-day action plan',
        '9. Expected business impact',
        '',
        `Expected output artifact: ${workflow.output}`
    ].filter(Boolean).join('\n');
}

module.exports = {
    getWorkflows() {
        return Object.values(WORKFLOWS);
    },
    getWorkflow(id) {
        return normalizeWorkflow(id);
    },
    detectWorkflowFromText,
    buildMissionBrief,
    buildAuditBundle
};
