function isExternalActionConfirmed(name, args = {}, result = null, helpers = {}) {
    if (!name) return false;
    if (name === 'metaAds') return Boolean(helpers.isSuccessfulMetaPublishResult?.(result));
    if (name === 'linkedinPublishPost' || (name === 'linkedinAds' && args?.action === 'publishPost')) {
        return Boolean(result && typeof result === 'object' && (result.success === true || result.id));
    }
    if (name === 'linkedinDeletePost' || (name === 'linkedinAds' && args?.action === 'deletePost')) {
        return Boolean(result && typeof result === 'object' && (result.success === true || result.deleted === true));
    }
    if (name === 'xDeletePost' || (name === 'xAds' && args?.action === 'deletePost')) {
        return Boolean(result && typeof result === 'object' && (result.success === true || result.deleted === true));
    }
    if (name === 'googleAds' && ['createCampaign', 'createBudget', 'createAdGroup', 'addKeywords', 'createResponsiveSearchAd'].includes(String(args?.action || ''))) {
        if (Array.isArray(result) && result.length > 0) return true;
        return Boolean(result && typeof result === 'object' && (result.resource_name || result.id || result.success === true));
    }
    if (['googleAdsCreateCampaign', 'googleAdsCreateBudget', 'googleAdsCreateAdGroup', 'googleAdsAddKeywords', 'googleAdsCreateResponsiveSearchAd'].includes(name)) {
        if (Array.isArray(result) && result.length > 0) return true;
        return Boolean(result && typeof result === 'object' && (result.resource_name || result.id || result.success === true));
    }
    if (name === 'sendEmail' || name === 'sendWhatsApp' || name === 'sendWhatsAppMedia') {
        const serialized = typeof result === 'string' ? result.toLowerCase() : JSON.stringify(result || {}).toLowerCase();
        return !serialized.startsWith('error') && !serialized.includes('"error"');
    }
    return true;
}

async function preflightExternalAction(toolCall = {}, deps = {}, helpers = {}) {
    const { name, args = {} } = toolCall;
    const {
        metaAdsTool,
        googleAdsTool,
        linkedInAdsTool
    } = deps;
    const {
        latestUser = '',
        isCreativeAssetRequest = () => false,
        hasImageArtifact = () => false,
        isPlaceholderValue = () => false,
        shouldRequireCreativeAsset = () => false
    } = helpers;

    if (name === 'metaAds') {
        const status = typeof metaAdsTool?.getSetupStatus === 'function'
            ? await metaAdsTool.getSetupStatus()
            : { hasAccessToken: false };
        const action = String(args.action || '');

        const creativeFirst = shouldRequireCreativeAsset({ toolCall, latestUser, args }) || isCreativeAssetRequest(latestUser);
        if (creativeFirst && !hasImageArtifact()) {
            return {
                ok: false,
                error: `Meta action ${action} blocked: banner/image must be generated first. Use generateImage, then ask for approval to publish/promote.`,
                missingKeys: ['IMAGE_ASSET'],
                provider: 'meta'
            };
        }

        const placeholderKeys = ['pageId', 'adAccountId', 'imageHash', 'imagePath', 'videoPath', 'link'];
        const placeholders = placeholderKeys.filter((k) => isPlaceholderValue(args?.[k]));
        if (placeholders.length) {
            return {
                ok: false,
                error: `Meta action ${action} blocked: placeholder values detected for ${placeholders.join(', ')}. Provide real values or generate/upload the asset first.`,
                missingKeys: placeholders.map((k) => `REAL_${k.toUpperCase()}`),
                provider: 'meta'
            };
        }

        const needsPaidSetup = ['createCampaign', 'createAdSet', 'createAdCreative', 'createAd', 'uploadImage', 'getAccountInfo'].includes(action);
        const needsOrganicSetup = ['publishOrganicPost', 'publishOrganicPhoto', 'publishOrganicVideo', 'publishOrganicReel', 'getPageInsights'].includes(action);
        const requestedChannels = Array.isArray(args.channels) ? args.channels.map((item) => String(item || '').trim().toLowerCase()) : [];
        const missing = [];
        if (!status.hasAccessToken) missing.push('META_ACCESS_TOKEN');
        if (needsPaidSetup && !status.hasAdAccountId) missing.push('META_AD_ACCOUNT_ID');
        if (needsOrganicSetup && !status.hasPageId) missing.push('META_PAGE_ID');
        if (requestedChannels.includes('instagram') && !status.hasInstagramBusinessAccountId) missing.push('INSTAGRAM_BUSINESS_ACCOUNT_ID');
        if (missing.length) {
            return {
                ok: false,
                error: `Meta action ${action} is blocked by missing setup: ${missing.join(', ')}.`,
                missingKeys: missing,
                provider: 'meta'
            };
        }
        return { ok: true };
    }

    if (name === 'googleAds' || ['googleAdsCreateCampaign', 'googleAdsCreateBudget', 'googleAdsCreateAdGroup', 'googleAdsAddKeywords', 'googleAdsCreateResponsiveSearchAd', 'googleAdsListCampaigns'].includes(name)) {
        const status = await googleAdsTool.getSetupStatus();
        const missing = [];
        if (!status.hasClientId) missing.push('GOOGLE_ADS_CLIENT_ID');
        if (!status.hasClientSecret) missing.push('GOOGLE_ADS_CLIENT_SECRET');
        if (!status.hasDeveloperToken) missing.push('GOOGLE_ADS_DEVELOPER_TOKEN');
        if (!status.hasRefreshToken) missing.push('GOOGLE_ADS_REFRESH_TOKEN');
        if (missing.length) {
            return {
                ok: false,
                error: `Google Ads action ${args.action || name} is blocked by missing setup: ${missing.join(', ')}.`,
                missingKeys: missing,
                provider: 'google_ads'
            };
        }
        return { ok: true };
    }

    if (name === 'linkedinAds' || name === 'linkedinPublishPost' || name === 'linkedinDeletePost') {
        const status = await linkedInAdsTool.getSetupStatus();
        if (!status.hasAccessToken) {
            return {
                ok: false,
                error: 'LinkedIn publish is blocked by missing setup: LINKEDIN_ACCESS_TOKEN.',
                missingKeys: ['LINKEDIN_ACCESS_TOKEN'],
                provider: 'linkedin'
            };
        }
        return { ok: true };
    }

    return { ok: true };
}

module.exports = {
    isExternalActionConfirmed,
    preflightExternalAction
};
