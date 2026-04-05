const TOOL_SUPPORT_REGISTRY = {
    browserAction: {
        group: 'Browser automation',
        summary: 'Open sites, scan pages, fill forms, click, extract, and navigate step by step.',
        verifiedActions: ['open', 'scan page state', 'fill forms', 'click buttons', 'extract content', 'navigate sequentially']
    },
    generateImage: {
        group: 'Creative & media',
        summary: 'Generate image creatives from prompts.',
        verifiedActions: ['banner generation', 'poster creatives', 'thumbnail and ad image generation']
    },
    generateVideo: {
        group: 'Creative & media',
        summary: 'Generate videos from supported prompts or assets.',
        verifiedActions: ['promo video generation', 'reel-style video generation']
    },
    removeBg: {
        group: 'Creative & media',
        summary: 'Remove image backgrounds.',
        verifiedActions: ['background removal']
    },
    metaAds: {
        group: 'Marketing',
        summary: 'Manage Meta paid objects and publish supported organic Meta content.',
        verifiedActions: [
            'paid campaign object management',
            'supported organic publish: single post',
            'supported organic publish: photo',
            'supported organic publish: video',
            'supported organic publish: reel'
        ],
        unsupportedClaims: [
            'arbitrary organic carousel posting',
            'claiming every Meta ad format without verified implementation'
        ]
    },
    analyzeMarketingPage: {
        group: 'Marketing',
        summary: 'Analyze a page for marketing effectiveness.',
        verifiedActions: ['landing page analysis']
    },
    scanCompetitors: {
        group: 'Marketing',
        summary: 'Run competitor and market scans.',
        verifiedActions: ['competitor scans', 'market comparisons']
    },
    generateSocialCalendar: {
        group: 'Marketing',
        summary: 'Generate social content calendars.',
        verifiedActions: ['social media content calendars']
    },
    buildAgencyQuotePlan: {
        group: 'Business ops',
        summary: 'Build quote or proposal plans.',
        verifiedActions: ['quote planning', 'proposal planning']
    },
    createAgencyQuoteArtifacts: {
        group: 'Business ops',
        summary: 'Create quote documents.',
        verifiedActions: ['PDF quote artifact', 'CSV quote artifact', 'Markdown quote artifact']
    },
    sendEmail: {
        group: 'Business ops',
        summary: 'Send email to external recipients.',
        verifiedActions: ['email sending']
    },
    sendWhatsApp: {
        group: 'Business ops',
        summary: 'Send WhatsApp messages.',
        verifiedActions: ['WhatsApp text sending']
    },
    sendWhatsAppMedia: {
        group: 'Business ops',
        summary: 'Send WhatsApp media messages.',
        verifiedActions: ['WhatsApp media sending']
    },
    readFile: {
        group: 'Code & development',
        summary: 'Read local files.',
        verifiedActions: ['file reading']
    },
    writeFile: {
        group: 'Code & development',
        summary: 'Write local files.',
        verifiedActions: ['file writing']
    },
    replaceFileContent: {
        group: 'Code & development',
        summary: 'Patch existing file content.',
        verifiedActions: ['targeted file edits']
    },
    multiReplaceFileContent: {
        group: 'Code & development',
        summary: 'Patch multiple file regions.',
        verifiedActions: ['multi-region file edits']
    },
    runCommand: {
        group: 'Code & development',
        summary: 'Run terminal commands.',
        verifiedActions: ['command execution']
    },
    codeMap: {
        group: 'Code & development',
        summary: 'Map code structure.',
        verifiedActions: ['codebase mapping']
    },
    codeSearch: {
        group: 'Code & development',
        summary: 'Search code.',
        verifiedActions: ['code search']
    },
    codeFindFn: {
        group: 'Code & development',
        summary: 'Find functions in code.',
        verifiedActions: ['function lookup']
    },
    searchWeb: {
        group: 'Intelligence',
        summary: 'Search live web information.',
        verifiedActions: ['live web search']
    },
    saveMemory: {
        group: 'Intelligence',
        summary: 'Save durable memory.',
        verifiedActions: ['memory save']
    },
    searchMemory: {
        group: 'Intelligence',
        summary: 'Search saved memory.',
        verifiedActions: ['memory search']
    },
    findAgenticSkill: {
        group: 'Intelligence',
        summary: 'Find specialist skills.',
        verifiedActions: ['skill lookup']
    },
    readAgenticSkill: {
        group: 'Intelligence',
        summary: 'Load specialist skills.',
        verifiedActions: ['skill loading']
    },
    delegateToAgent: {
        group: 'Intelligence',
        summary: 'Delegate to sub-agents.',
        verifiedActions: ['sub-agent delegation']
    },
    askUserForInput: {
        group: 'Intelligence',
        summary: 'Request clarification or approval from the Boss.',
        verifiedActions: ['clarification', 'approval request']
    }
};

const DOMAIN_TOOL_PROFILES = {
    browser: {
        preferredTools: ['browserAction', 'searchWeb', 'askUserForInput'],
        allowedTools: ['browserAction', 'searchWeb', 'askUserForInput', 'saveMemory', 'searchMemory'],
        blockedTools: ['generateImage', 'generateVideo', 'metaAds', 'googleAds', 'linkedinAds', 'xAds', 'buildAgencyQuotePlan', 'createAgencyQuoteArtifacts']
    },
    code: {
        preferredTools: ['readFile', 'listDir', 'codeMap', 'codeSearch', 'codeFindFn', 'replaceFileContent', 'multiReplaceFileContent', 'runCommand'],
        allowedTools: ['readFile', 'writeFile', 'listDir', 'replaceFileContent', 'multiReplaceFileContent', 'runSed', 'runCommand', 'checkBackgroundTask', 'codeMap', 'codeSearch', 'codeFindFn', 'askUserForInput', 'saveMemory', 'searchMemory'],
        blockedTools: ['metaAds', 'googleAds', 'linkedinAds', 'xAds', 'sendEmail', 'sendWhatsApp', 'browserAction']
    },
    commercial: {
        preferredTools: ['buildAgencyQuotePlan', 'createAgencyQuoteArtifacts', 'askUserForInput'],
        allowedTools: ['buildAgencyQuotePlan', 'createAgencyQuoteArtifacts', 'askUserForInput', 'saveMemory', 'searchMemory'],
        blockedTools: ['browserAction', 'metaAds', 'googleAds', 'linkedinAds', 'xAds', 'generateImage', 'generateVideo']
    },
    outbound: {
        preferredTools: ['sendEmail', 'sendWhatsApp', 'askUserForInput'],
        allowedTools: ['sendEmail', 'sendWhatsApp', 'sendWhatsAppMedia', 'readEmail', 'askUserForInput', 'saveMemory', 'searchMemory'],
        blockedTools: ['browserAction', 'metaAds', 'googleAds', 'linkedinAds', 'xAds']
    },
    marketing_meta_organic: {
        preferredTools: ['generateImage', 'metaAds', 'askUserForInput'],
        allowedTools: ['generateImage', 'metaAds', 'analyzeMarketingPage', 'scanCompetitors', 'generateSocialCalendar', 'askUserForInput', 'saveMemory', 'searchMemory'],
        blockedTools: ['browserAction', 'buildAgencyQuotePlan', 'createAgencyQuoteArtifacts']
    },
    image: {
        preferredTools: ['generateImage', 'removeBg', 'askUserForInput'],
        allowedTools: ['generateImage', 'removeBg', 'askUserForInput', 'saveMemory', 'searchMemory'],
        blockedTools: ['browserAction', 'generateVideo', 'metaAds', 'googleAds', 'linkedinAds', 'xAds', 'buildAgencyQuotePlan', 'createAgencyQuoteArtifacts']
    },
    video: {
        preferredTools: ['generateVideo', 'askUserForInput'],
        allowedTools: ['generateVideo', 'askUserForInput', 'saveMemory', 'searchMemory'],
        blockedTools: ['browserAction', 'generateImage', 'removeBg', 'metaAds', 'googleAds', 'linkedinAds', 'xAds', 'buildAgencyQuotePlan', 'createAgencyQuoteArtifacts']
    },
    media: {
        preferredTools: ['generateImage', 'generateVideo', 'removeBg', 'askUserForInput'],
        allowedTools: ['generateImage', 'generateVideo', 'removeBg', 'askUserForInput', 'saveMemory', 'searchMemory'],
        blockedTools: ['browserAction', 'metaAds', 'googleAds', 'linkedinAds', 'xAds', 'buildAgencyQuotePlan', 'createAgencyQuoteArtifacts']
    },
    general: {
        preferredTools: ['askUserForInput', 'searchWeb'],
        allowedTools: null,
        blockedTools: []
    }
};

function cloneProfile(domain, overrides = {}) {
    const base = DOMAIN_TOOL_PROFILES[domain] || DOMAIN_TOOL_PROFILES.general;
    return {
        domain,
        preferredTools: Array.isArray(overrides.preferredTools) ? overrides.preferredTools : [...(base.preferredTools || [])],
        allowedTools: Array.isArray(overrides.allowedTools)
            ? overrides.allowedTools
            : (Array.isArray(base.allowedTools) ? [...base.allowedTools] : null),
        blockedTools: Array.isArray(overrides.blockedTools) ? overrides.blockedTools : [...(base.blockedTools || [])]
    };
}

function buildCapabilitySummary() {
    return [
        'These are my real working capability groups:',
        '',
        '- Browser automation: open sites, scan pages, fill forms, click, extract, navigate',
        '- Creative/media: generate images, generate videos, remove backgrounds',
        '- Marketing: Meta paid object management, supported organic Meta publishing, marketing analysis, competitor scans, social calendars',
        '- Business ops: quotes, quote documents, email, WhatsApp',
        '- Code/dev: read files, edit files, run commands, code search/map',
        '- Intelligence: web search, memory save/search, skill lookup/read, delegation',
        '',
        'Important: I should describe only verified tool support, not broad platform-wide possibilities.'
    ].join('\n');
}

function buildMetaWaysSummary() {
    const metaSupport = TOOL_SUPPORT_REGISTRY.metaAds;
    return [
        'I can use `metaAds` in 2 real ways right now:',
        '',
        `1. ${metaSupport.verifiedActions[0].charAt(0).toUpperCase()}${metaSupport.verifiedActions[0].slice(1)}`,
        '2. Supported organic publishing: single post/photo/video/reel',
        '',
        'I do not currently support arbitrary organic carousel posting unless a real tool path is added.'
    ].join('\n');
}

function buildMetaTypesSummary() {
    return [
        'For Meta, I should answer only with what the real tool supports today:',
        '',
        '- Paid campaign objects: campaign, ad set, creative, ad',
        '- Organic publish actions: single post, photo, video, reel',
        '- Insights/comments/account info where supported',
        '',
        'I should not claim full support for every Meta format like carousel/collection unless we implement and verify that path.'
    ].join('\n');
}

module.exports = {
    TOOL_SUPPORT_REGISTRY,
    DOMAIN_TOOL_PROFILES,
    cloneProfile,
    buildCapabilitySummary,
    buildMetaWaysSummary,
    buildMetaTypesSummary
};
