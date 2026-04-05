function inferMissingKeys(text = '') {
    const value = String(text || '');
    const lower = value.toLowerCase();
    const directKeys = Array.from(new Set((value.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || []).filter((key) => key.includes('_'))));
    if (directKeys.length) return directKeys;

    const inferred = [];

    if (lower.includes('meta api token missing') || lower.includes('meta access token') || lower.includes('error validating access token') || lower.includes('session has expired')) inferred.push('META_ACCESS_TOKEN');
    if (lower.includes('missing page id') || lower.includes('page id')) inferred.push('META_PAGE_ID');
    if (lower.includes('instagram business account id')) inferred.push('INSTAGRAM_BUSINESS_ACCOUNT_ID');

    if (lower.includes('gmail credentials') || lower.includes('gmail_user') || lower.includes('gmail app password') || lower.includes('gmail_app_password')) inferred.push('GMAIL_USER', 'GMAIL_APP_PASSWORD');
    if (lower.includes('whatsapp credentials')) inferred.push('META_ACCESS_TOKEN', 'WHATSAPP_PHONE_ID');

    if (lower.includes('linkedin_access_token') || lower.includes('linkedin access token')) inferred.push('LINKEDIN_ACCESS_TOKEN');

    if (lower.includes('google_ads_client_id') || lower.includes('google ads client id')) inferred.push('GOOGLE_ADS_CLIENT_ID');
    if (lower.includes('google_ads_client_secret') || lower.includes('google ads client secret')) inferred.push('GOOGLE_ADS_CLIENT_SECRET');
    if (lower.includes('google_ads_developer_token') || lower.includes('developer token')) inferred.push('GOOGLE_ADS_DEVELOPER_TOKEN');
    if (lower.includes('google_ads_refresh_token') || lower.includes('refresh token')) inferred.push('GOOGLE_ADS_REFRESH_TOKEN');

    if (lower.includes('openrouter_api_token')) inferred.push('OPENROUTER_API_TOKEN');
    if (lower.includes('replicate_api_token')) inferred.push('REPLICATE_API_TOKEN');
    if (lower.includes('brave_search_api_key')) inferred.push('BRAVE_SEARCH_API_KEY');

    return Array.from(new Set(inferred));
}

function buildRequirementPrompt({ toolCall = {}, keys = [], scopeLabel = 'Boss workspace', reason = '' } = {}) {
    const toolName = toolCall?.name || 'tool';
    const detail = String(reason || '').trim();
    const keyMessage = keys.length === 1
        ? `Reply with the value for ${keys[0]} and Nexus will save it to the ${scopeLabel}, then continue.`
        : `Reply using KEY=value or KEY: value lines for these settings: ${keys.join(', ')}. Nexus will save them to the ${scopeLabel}, then continue.`;
    const prefix = detail
        ? `${detail}\n\n`
        : `Mission is blocked by missing configuration for ${toolName}: ${keys.join(', ')}.\n\n`;
    return `${prefix}Save target: ${scopeLabel}.\n${keyMessage}`;
}

function classifyRequirementKind(keys = []) {
    const list = Array.isArray(keys) ? keys : [];
    if (list.some((key) => ['IMAGE_ASSET', 'VIDEO_ASSET'].includes(String(key)))) return 'transient_asset';
    if (list.some((key) => /^REAL_/.test(String(key)))) return 'transient_value';
    return 'config';
}

function classifyToolRequirement({ toolCall = {}, resultString = '', scope = 'boss', scopeLabel = 'Boss workspace', looksLikeMetaToken = () => false } = {}) {
    const text = String(resultString || '');
    const lower = text.toLowerCase();
    const name = String(toolCall?.name || '');

    if (name === 'metaAds' && looksLikeMetaToken(toolCall?.args?.pageId)) {
        return {
            keys: ['META_PAGE_ID'],
            scope,
            message: `Meta publish is blocked because the current META_PAGE_ID looks like an access token, not a real Page ID. Please provide the correct META_PAGE_ID for the ${scopeLabel}.`
        };
    }

    if (name === 'metaAds' && (lower.includes('session has expired') || lower.includes('error validating access token') || lower.includes('"code":190') || lower.includes('"error_subcode":463'))) {
        return {
            keys: ['META_ACCESS_TOKEN'],
            scope,
            message: `Meta access token expired or is invalid. Please provide a new META_ACCESS_TOKEN for the ${scopeLabel} and Nexus will continue the publish flow.`
        };
    }

    const authHints = (
        lower.includes('session has expired') ||
        lower.includes('invalid access token') ||
        lower.includes('error validating access token') ||
        lower.includes('oauthexception') ||
        lower.includes('oauth exception') ||
        lower.includes('authentication failed') ||
        lower.includes('invalid_grant') ||
        lower.includes('unauthorized')
    );

    if (!(authHints || lower.includes('missing') || lower.includes('not configured') || lower.includes('not initialized') || lower.includes('blocked by missing setup') || lower.includes('placeholder values detected'))) {
        return null;
    }

    const keys = inferMissingKeys(text);
    if (!keys.length) return null;

    const reason = authHints
        ? `Mission is blocked by invalid, expired, or missing credentials for ${name}: ${keys.join(', ')}.`
        : `Mission is blocked by missing configuration for ${name}: ${keys.join(', ')}.`;

    return {
        keys,
        scope,
        kind: classifyRequirementKind(keys),
        message: classifyRequirementKind(keys) === 'transient_asset'
            ? `Mission is blocked by a missing asset for ${name}: ${keys.join(', ')}.\n\nReply with the image/file URL or local path for this current mission and Nexus will continue without saving it as workspace config.`
            : buildRequirementPrompt({ toolCall, keys, scopeLabel, reason })
    };
}

module.exports = {
    inferMissingKeys,
    buildRequirementPrompt,
    classifyToolRequirement,
    classifyRequirementKind
};
