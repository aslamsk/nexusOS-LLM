function isBrowserMissionRequest(text = '') {
    const value = String(text || '').toLowerCase();
    return /\b(open|browser|url|http|click|navigate|fill|form|submit|quiz|question|option|login|portal|website)\b/.test(value);
}

function shouldForceBrowserContinuation({ originalRequest = '', contractObjective = '', latestUser = '', browserToolUsed = false } = {}) {
    const request = String(originalRequest || contractObjective || latestUser || '').toLowerCase();
    return isBrowserMissionRequest(request) || Boolean(browserToolUsed);
}

function isBrowserHesitationResponse(text = '') {
    const value = String(text || '').toLowerCase();
    return (
        value.includes('do not have the inherent knowledge') ||
        value.includes('i do not have the inherent knowledge') ||
        value.includes('need your instructions on how to determine') ||
        value.includes('cannot determine the correct answers') ||
        value.includes('please provide the correct answers') ||
        value.includes('i will need your instructions')
    );
}

function buildNarratedActionCorrection({
    userRequest = '',
    domain = 'general',
    shouldForceBrowser = false,
    targetUrl = '',
    isMetaOrganicImageRequest = false
} = {}) {
    const latestUser = String(userRequest || '').trim();
    const normalizedDomain = String(domain || 'general').toLowerCase();

    if (shouldForceBrowser) {
        return `ERROR: You narrated browser work instead of using a real tool call. Use browserAction only. Start with browserAction using action "open"${targetUrl ? ` and url "${targetUrl}"` : ''} if the page is not already open. Then inspect the page with getMarkdown or extractActiveElements and continue step by step. Respond ONLY with a valid structured tool call.`;
    }
    if (isMetaOrganicImageRequest) {
        return 'ERROR: For this Meta organic image request, do not narrate. First call generateImage to create the single-image creative. After the creative exists, prepare the organic Meta publish payload and wait for approval before any publish action. Respond ONLY with a valid tool call.';
    }
    if (normalizedDomain === 'image') {
        return 'ERROR: You narrated an image result without using the tool. Call generateImage with a concrete prompt and save path. Respond ONLY with a valid structured tool call.';
    }
    if (normalizedDomain === 'video') {
        return 'ERROR: You narrated a video result without using the tool. Call generateVideo with the required prompt or imagePath. Respond ONLY with a valid structured tool call.';
    }
    if (normalizedDomain === 'commercial') {
        return 'ERROR: You narrated commercial output without using the tools. Call buildAgencyQuotePlan or createAgencyQuoteArtifacts to produce the actual quote deliverable. Respond ONLY with a valid structured tool call.';
    }
    if (normalizedDomain === 'outbound') {
        return 'ERROR: You narrated an outbound action without using the tool. Call sendEmail, sendWhatsApp, or sendWhatsAppMedia with the actual payload. Respond ONLY with a valid structured tool call.';
    }
    if (normalizedDomain === 'code') {
        return 'ERROR: You narrated a code change without using the tools. Use readFile, replaceFileContent, multiReplaceFileContent, runCommand, or other allowed code tools to perform and verify the actual change. Respond ONLY with a valid structured tool call.';
    }
    return 'ERROR: You narrated an action or provided a fake deliverable placeholder but failed to provide a structured tool call. DO NOT narrate tool execution in text. Use the available tools via the function schema to perform actions. Respond ONLY with a REAL tool call.';
}

function isWeakBrowserTextTurn({ response = {}, originalRequest = '', shouldForceBrowser = false } = {}) {
    if (!shouldForceBrowser) return false;
    if (response?.toolCall) return false;
    const text = String(response?.text || '').trim().toLowerCase();
    if (!text) return true;
    return (
        text.includes('let me start by') ||
        text.includes('here\'s my plan') ||
        text.includes('i will open') ||
        text.includes('i can help you') ||
        text.includes('to get started') ||
        text.includes('ready for your instructions')
    );
}

function extractBrowserBlockerReason(text = '') {
    const value = String(text || '').toLowerCase();
    if (value.includes('captcha_detected')) return 'CAPTCHA detected on the page. Human help is required.';
    if (value.includes('otp_required')) return 'OTP / verification code is required to continue.';
    if (value.includes('checkpoint_detected')) return 'Account checkpoint / identity confirmation detected.';
    if (value.includes('mfa_required')) return 'Multi-factor authentication is required to continue.';
    return null;
}

module.exports = {
    isBrowserMissionRequest,
    shouldForceBrowserContinuation,
    isBrowserHesitationResponse,
    buildNarratedActionCorrection,
    isWeakBrowserTextTurn,
    extractBrowserBlockerReason
};
