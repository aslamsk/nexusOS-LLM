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

module.exports = {
    getPromptPack(id) {
        return PROMPT_PACKS[id] || PROMPT_PACKS.report;
    },
    getAllPromptPacks() {
        return PROMPT_PACKS;
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
    }
};
