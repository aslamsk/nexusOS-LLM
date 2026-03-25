const PROMPT_PACKS = {
    audit: {
        system: 'You are a senior growth strategist producing a client-ready marketing audit.',
        focus: [
            'content clarity and message-market fit',
            'conversion friction and CTA strength',
            'SEO and discoverability',
            'competitive positioning',
            'brand trust and growth strategy'
        ]
    },
    copy: {
        system: 'You are a conversion copywriter improving messaging for revenue impact.',
        focus: [
            'headline rewrites',
            'CTA alternatives',
            'offer articulation',
            'before/after copy blocks'
        ]
    },
    ads: {
        system: 'You are a paid-media strategist preparing campaign-ready ad plans.',
        focus: [
            'audience and intent mapping',
            'creative angles',
            'Meta / Google / LinkedIn positioning',
            'campaign structure and offer framing'
        ]
    },
    report: {
        system: 'You are a client-facing marketing consultant preparing polished reports and proposals.',
        focus: [
            'executive summary',
            'prioritized recommendations',
            'deliverable framing',
            'professional presentation language'
        ]
    }
};

const AUDIT_SPECIALISTS = {
    content: {
        label: 'Content Analyst',
        focus: ['message clarity', 'offer articulation', 'CTA strength', 'trust language'],
        deliverable: 'Summarize message gaps, weak sections, and copy-level quick wins.'
    },
    conversion: {
        label: 'Conversion Analyst',
        focus: ['user journey friction', 'CTA placement', 'form/lead capture', 'conversion blockers'],
        deliverable: 'Score conversion readiness and list the most likely causes of drop-off.'
    },
    competitive: {
        label: 'Competitive Analyst',
        focus: ['positioning', 'differentiation', 'offer comparison', 'market opportunity'],
        deliverable: 'Explain where the brand is undifferentiated and where it can win.'
    },
    technical: {
        label: 'Technical / SEO Analyst',
        focus: ['SEO basics', 'discoverability', 'performance signals', 'information structure'],
        deliverable: 'Flag technical issues that hurt discoverability or trust.'
    },
    strategy: {
        label: 'Growth Strategist',
        focus: ['growth priorities', 'campaign direction', 'revenue impact', 'implementation roadmap'],
        deliverable: 'Turn the findings into a prioritized action plan tied to business impact.'
    }
};

module.exports = {
    getPromptPack(id) {
        return PROMPT_PACKS[id] || PROMPT_PACKS.report;
    },
    getAllPromptPacks() {
        return PROMPT_PACKS;
    },
    getAuditSpecialists() {
        return AUDIT_SPECIALISTS;
    },
    buildPromptContext(id, workflow = null) {
        const pack = PROMPT_PACKS[id] || PROMPT_PACKS.report;
        const workflowLine = workflow ? `Workflow: ${workflow.label}.` : '';
        return [
            '### MARKETING STRATEGY PACK',
            workflowLine,
            `Operating role: ${pack.system}`,
            `Focus areas: ${(pack.focus || []).join(', ')}.`,
            'Use the existing Nexus OS tools and approvals exactly as they are.',
            'Keep outputs client-ready, commercially useful, and specific enough for implementation.'
        ].filter(Boolean).join('\n');
    },
    buildAuditBundleContext({ workflow, target, clientName, notes, budget, channels }) {
        const channelLine = channels?.length ? `Channels under review: ${channels.join(', ')}.` : '';
        const budgetLine = budget ? `Working budget reference: ${budget}.` : '';
        const noteLine = notes ? `Client notes: ${notes}` : '';
        const specialistLines = Object.entries(AUDIT_SPECIALISTS).map(([key, specialist]) => {
            return [
                `#### ${specialist.label} (${key})`,
                `Focus: ${specialist.focus.join(', ')}.`,
                `Expected section: ${specialist.deliverable}`
            ].join('\n');
        });
        return [
            '### MULTI-SPECIALIST AUDIT MODE',
            `Workflow: ${workflow?.label || 'Marketing Audit'}.`,
            target ? `Primary target: ${target}.` : '',
            clientName ? `Client: ${clientName}.` : '',
            channelLine,
            budgetLine,
            noteLine,
            '',
            'Produce the audit as five coordinated specialist passes followed by a unified executive summary.',
            'For each specialist, include a score out of 10, the biggest risk, and the fastest win.',
            '',
            ...specialistLines,
            '',
            'Close with: overall score, top 5 priorities, and a 30-day implementation sequence.'
        ].filter(Boolean).join('\n');
    }
};
