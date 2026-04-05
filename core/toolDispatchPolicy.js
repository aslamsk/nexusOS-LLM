function normalizeToolCall(toolCall = {}, helpers = {}) {
    const isBlankValue = typeof helpers.isBlankValue === 'function'
        ? helpers.isBlankValue
        : (value) => value === null || value === undefined || String(value).trim() === '';

    const browserActionAliases = new Set([
        'open',
        'click',
        'clickPixel',
        'clickText',
        'type',
        'clearAndType',
        'focus',
        'keyPress',
        'hover',
        'scroll',
        'extract',
        'extractActiveElements',
        'getMarkdown',
        'screenshot',
        'waitForNetworkIdle',
        'waitForSelector'
    ]);

    if (browserActionAliases.has(toolCall.name)) {
        return {
            name: 'browserAction',
            args: {
                ...(toolCall.args || {}),
                action: toolCall.name
            }
        };
    }

    if (toolCall.name === 'browserAction') {
        return {
            ...toolCall,
            args: { ...(toolCall.args || {}) }
        };
    }

    if (toolCall.name === 'metaAds') {
        const normalizedArgs = { ...(toolCall.args || {}) };
        if ('boss_approved' in normalizedArgs) delete normalizedArgs.boss_approved;
        if (typeof normalizedArgs.body === 'string' && normalizedArgs.body.trim()) {
            try {
                const parsedBody = JSON.parse(normalizedArgs.body);
                if (parsedBody && typeof parsedBody === 'object') {
                    normalizedArgs.message = normalizedArgs.message || parsedBody.message || '';
                    normalizedArgs.link = normalizedArgs.link || parsedBody?.call_to_action?.link || parsedBody.link || '';
                    normalizedArgs.imagePath = normalizedArgs.imagePath || parsedBody.media_url || parsedBody.imagePath || '';
                    normalizedArgs.cta = normalizedArgs.cta || parsedBody?.call_to_action?.type || '';
                    normalizedArgs.title = normalizedArgs.title || parsedBody.title || '';
                    normalizedArgs.pageId = isBlankValue(normalizedArgs.pageId) ? (parsedBody.pageId || '') : normalizedArgs.pageId;
                }
            } catch (_) {}
        }
        return {
            ...toolCall,
            args: normalizedArgs
        };
    }

    if (toolCall.name === 'googleAdsCreateBudget') {
        return { name: 'googleAds', args: { ...(toolCall.args || {}), action: 'createBudget' } };
    }
    if (toolCall.name === 'googleAdsCreateCampaign') {
        return { name: 'googleAds', args: { ...(toolCall.args || {}), action: 'createCampaign' } };
    }
    if (toolCall.name === 'googleAdsCreateAdGroup') {
        return { name: 'googleAds', args: { ...(toolCall.args || {}), action: 'createAdGroup' } };
    }
    if (toolCall.name === 'googleAdsAddKeywords') {
        return { name: 'googleAds', args: { ...(toolCall.args || {}), action: 'addKeywords' } };
    }
    if (toolCall.name === 'googleAdsCreateResponsiveSearchAd') {
        return { name: 'googleAds', args: { ...(toolCall.args || {}), action: 'createResponsiveSearchAd' } };
    }
    if (toolCall.name === 'googleAdsListCampaigns') {
        return { name: 'googleAds', args: { ...(toolCall.args || {}), action: 'listCampaigns' } };
    }
    if (toolCall.name === 'linkedinPublishPost') {
        return { name: 'linkedinAds', args: { ...(toolCall.args || {}), action: 'publishPost' } };
    }
    if (toolCall.name === 'linkedinDeletePost') {
        return { name: 'linkedinAds', args: { ...(toolCall.args || {}), action: 'deletePost' } };
    }
    if (toolCall.name === 'twitterAds' || toolCall.name === 'x' || toolCall.name === 'tweet') {
        return { name: 'xAds', args: { ...(toolCall.args || {}) } };
    }
    if (toolCall.name === 'xDeletePost') {
        return { name: 'xAds', args: { ...(toolCall.args || {}), action: 'deletePost' } };
    }

    return toolCall;
}

function inferToolDomain(toolCall = {}) {
    const name = String(toolCall?.name || '').toLowerCase();
    const action = String(toolCall?.args?.action || '').toLowerCase();

    if (name === 'browseraction') return 'browser';
    if (name === 'searchweb') return 'research';
    if (['generateimage', 'generatevideo', 'removebg'].includes(name)) return 'media';
    if (['metaads', 'googleads', 'linkedinads', 'xads'].includes(name) || action.includes('campaign') || action.includes('publish')) return 'marketing';
    if (['buildagencyquoteplan', 'createagencyquoteartifacts'].includes(name)) return 'commercial';
    if (['sendemail', 'reademail', 'sendwhatsapp', 'sendwhatsappmedia'].includes(name)) return 'communications';
    if (['readfile', 'writefile', 'replacefilecontent', 'multireplacefilecontent', 'runcommand', 'codemap', 'codesearch', 'codefindfn'].includes(name)) return 'development';
    return 'general';
}

module.exports = {
    normalizeToolCall,
    inferToolDomain
};
