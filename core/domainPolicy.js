const { cloneProfile } = require('./toolRegistry');

function buildMixedProfile(domains = []) {
    const uniqueDomains = Array.from(new Set((domains || []).filter(Boolean)));
    const profiles = uniqueDomains.map((domain) => cloneProfile(domain));
    const preferredTools = [];
    const allowedTools = [];
    const blockedTools = profiles.length
        ? profiles
            .map((profile) => new Set(profile.blockedTools || []))
            .reduce((shared, current) => new Set([...shared].filter((item) => current.has(item))))
        : new Set();

    for (const profile of profiles) {
        for (const tool of profile.preferredTools || []) {
            if (!preferredTools.includes(tool)) preferredTools.push(tool);
        }
        for (const tool of profile.allowedTools || []) {
            if (!allowedTools.includes(tool)) allowedTools.push(tool);
        }
    }

    const hasMarketing = uniqueDomains.includes('marketing') || uniqueDomains.includes('marketing_meta_organic');
    const hasCreativeOrBrowser = uniqueDomains.some((domain) => ['browser', 'image', 'video', 'media'].includes(domain));
    if (hasMarketing && hasCreativeOrBrowser) {
        const marketingExecutionTools = ['metaAds', 'googleAds', 'linkedinAds', 'xAds', 'analyzeMarketingPage', 'scanCompetitors', 'generateSocialCalendar'];
        for (const tool of marketingExecutionTools) {
            if (!allowedTools.includes(tool)) allowedTools.push(tool);
        }
        for (const tool of ['metaAds', 'analyzeMarketingPage']) {
            if (!preferredTools.includes(tool)) preferredTools.push(tool);
        }
    }

    if (uniqueDomains.includes('browser')) {
        const filteredAllowed = allowedTools.filter((tool) => tool !== 'searchWeb');
        allowedTools.length = 0;
        allowedTools.push(...filteredAllowed);
    }

    return {
        domain: uniqueDomains.join('+') || 'general',
        preferredTools,
        allowedTools,
        blockedTools: Array.from(blockedTools)
    };
}

function deriveTaskRoutingProfile(lower = '') {
    const isBrowserTask = /\b(open|browser|website|site|page|url|portal|login|navigate|click|fill|form|submit|quiz|question)\b/.test(lower);
    const isCodeTask = /\b(code|bug|fix|debug|file|function|repo|project|server|frontend|backend|test)\b/.test(lower);
    const isCommercialTask = /\b(quote|quotation|proposal|invoice|pricing|estimate)\b/.test(lower);
    const isMarketingTask = /\b(marketing|audit|seo|campaign|ad|social|competitor|landing page|organic|facebook|instagram|meta|metaads)\b/.test(lower);
    const isImageTask = /\b(image|banner|poster|creative|thumbnail|logo|flyer|brochure)\b/.test(lower);
    const isVideoTask = /\b(video|reel|shorts|animation|promo video|promo reel)\b/.test(lower);
    const isOutboundTask = /\b(email|whatsapp|send|share|reply|message)\b/.test(lower);
    const wantsResearch = /\b(search|research|browse|find online|look up|google)\b/.test(lower);
    const hasExplicitMarketingExecutionIntent = /\b(campaign|seo|audit|publish|post|promote|promot|facebook|instagram|meta|metaads|google ads|linkedin ads|social)\b/.test(lower);

    const isMetaOrganicTask = /\b(organic|facebook|instagram|meta|metaads)\b/.test(lower) && /\b(post|publish|promote|promot|ad|creative|image|banner|photo|video)\b/.test(lower);
    const mixedDomains = [];

    if (isBrowserTask) mixedDomains.push('browser');
    if (isCodeTask) mixedDomains.push('code');
    if (isCommercialTask) mixedDomains.push('commercial');
    if (isOutboundTask) mixedDomains.push('outbound');
    if (isMarketingTask) mixedDomains.push('marketing');
    if (isImageTask && !isVideoTask) mixedDomains.push('image');
    if (isVideoTask && !isImageTask) mixedDomains.push('video');
    if (isImageTask && isVideoTask) mixedDomains.push('media');

    if (isCommercialTask && !hasExplicitMarketingExecutionIntent) {
        const filteredDomains = mixedDomains.filter((domain) => domain !== 'marketing');
        mixedDomains.length = 0;
        mixedDomains.push(...filteredDomains);
    }

    const meaningfulMixedDomains = mixedDomains.filter((domain) => domain !== 'marketing' || isMetaOrganicTask || isMarketingTask);
    if (meaningfulMixedDomains.length > 1) {
        const normalizedMixed = meaningfulMixedDomains.map((domain) => {
            if (domain === 'marketing' && isMetaOrganicTask) return 'marketing_meta_organic';
            return domain;
        });
        return buildMixedProfile(normalizedMixed);
    }

    if (isBrowserTask) return cloneProfile('browser');
    if (isCodeTask) return cloneProfile('code');
    if (isCommercialTask) return cloneProfile('commercial');
    if (isOutboundTask) return cloneProfile('outbound');

    if (isMarketingTask && isMetaOrganicTask) {
        return {
            ...cloneProfile('marketing_meta_organic'),
            domain: 'marketing'
        };
    }

    if (isImageTask && !isVideoTask) return cloneProfile('image');
    if (isVideoTask && !isImageTask) return cloneProfile('video');
    if (isImageTask && isVideoTask) return cloneProfile('media');

    if (isMarketingTask) {
        const allowedTools = ['analyzeMarketingPage', 'scanCompetitors', 'generateSocialCalendar', 'askUserForInput', 'saveMemory', 'searchMemory'];
        if (isMetaOrganicTask) allowedTools.push('generateImage', 'metaAds');
        if (wantsResearch) allowedTools.push('searchWeb');
        return {
            ...cloneProfile('general'),
            domain: 'marketing',
            preferredTools: isMetaOrganicTask
                ? ['generateImage', 'metaAds', 'askUserForInput']
                : ['analyzeMarketingPage', 'scanCompetitors', 'generateSocialCalendar', wantsResearch ? 'searchWeb' : 'askUserForInput'].filter(Boolean),
            allowedTools,
            blockedTools: ['browserAction', 'buildAgencyQuotePlan', 'createAgencyQuoteArtifacts']
        };
    }

    return cloneProfile('general');
}

function shouldRecallLongTermMemory(domain = '') {
    const normalized = String(domain || '').toLowerCase();
    return !['browser', 'image', 'video', 'commercial', 'outbound'].includes(normalized);
}

function shouldInjectMarketingWorkflow(domain = '') {
    return String(domain || '').toLowerCase() === 'marketing';
}

function shouldAutoLoadSpecialistSkill(request = '', domain = '') {
    const normalizedDomain = String(domain || '').toLowerCase();
    if (['browser', 'image', 'video', 'commercial', 'outbound'].includes(normalizedDomain)) return false;
    const value = String(request || '');
    return /\b(audit|architecture|refactor|deep|advanced|complex|specialist|expert|strategy|seo|security)\b/i.test(value) ||
        value.split(/\s+/).filter(Boolean).length >= 18;
}

function isToolRelevantToTask({ toolCall = {}, request = '', routingProfile = null }) {
    const name = String(toolCall?.name || '').toLowerCase();
    const argsText = JSON.stringify(toolCall?.args || {}).toLowerCase();
    const normalizedRequest = String(request || '').toLowerCase();
    if (!normalizedRequest) return true;

    const allowedTools = Array.isArray(routingProfile?.allowedTools)
        ? routingProfile.allowedTools.map((item) => String(item || '').toLowerCase())
        : null;
    const blockedTools = Array.isArray(routingProfile?.blockedTools)
        ? routingProfile.blockedTools.map((item) => String(item || '').toLowerCase())
        : [];

    if (blockedTools.includes(name)) return false;
    if (allowedTools && allowedTools.length && !allowedTools.includes(name)) return false;

    const forcedDomain = String(routingProfile?.domain || '').toLowerCase();
    if (['image', 'video', 'media'].includes(forcedDomain) && ['generateimage', 'generatevideo', 'removebg'].includes(name)) return true;
    if (forcedDomain === 'commercial' && ['buildagencyquoteplan', 'createagencyquoteartifacts'].includes(name)) return true;
    if (forcedDomain === 'browser' && name === 'browseraction') return true;

    const mentions = (...patterns) => patterns.some((pattern) => pattern.test(normalizedRequest));
    const isCodeTask = mentions(/\bcode|bug|fix|debug|file|function|repo|project\b/);
    const isMarketingTask = mentions(/\bmarketing|audit|seo|landing page|campaign|ad|social|competitor\b/);
    const isCommercialTask = mentions(/\bquote|quotation|proposal|invoice|pricing|estimate\b/);
    const isMediaTask = mentions(/\bimage|banner|poster|creative|thumbnail|logo|video|reel\b/);
    const isOutboundTask = mentions(/\bemail|whatsapp|send|share\b/);
    const asksForResearch = mentions(/\bsearch|research|browse|find|look up|google\b/);

    if (['sendemail', 'sendwhatsapp', 'sendwhatsappmedia'].includes(name) && !isOutboundTask) return false;
    if (['buildagencyquoteplan', 'createagencyquoteartifacts'].includes(name) && !isCommercialTask) return false;
    if (['generateimage', 'generatevideo', 'removebg'].includes(name) && !isMediaTask) return false;
    if (['readfile', 'writefile', 'replacefilecontent', 'multireplacefilecontent', 'runcommand', 'codemap', 'codesearch', 'codefindfn'].includes(name) && !isCodeTask) return false;
    if (['analyzemarketingpage', 'scancompetitors', 'generatesocialcalendar', 'metaads', 'googleads', 'linkedinads', 'xads'].includes(name) && !(isMarketingTask || isOutboundTask || isCommercialTask)) return false;
    if (name === 'searchweb' && !asksForResearch && !(isMarketingTask && /competitor|benchmark|trend/.test(normalizedRequest))) return false;
    if ((name === 'readagenticskill' || name === 'findagenticskill') && !mentions(/\bcomplex|architecture|deep|advanced|audit|specialist|expert\b/)) return false;
    if (name === 'browseraction' && !mentions(/\bbrowser|website|site|page|url|portal|login|open|navigate|click|form\b/) && !/https?:/.test(argsText)) return false;

    return true;
}

module.exports = {
    deriveTaskRoutingProfile,
    shouldRecallLongTermMemory,
    shouldInjectMarketingWorkflow,
    shouldAutoLoadSpecialistSkill,
    isToolRelevantToTask
};
