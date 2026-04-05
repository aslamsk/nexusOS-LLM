const {
    buildCapabilitySummary,
    buildMetaWaysSummary,
    buildMetaTypesSummary
} = require('./toolRegistry');

function isCapabilityQuestion(text = '') {
    const value = String(text || '').toLowerCase();
    return /\b(what can you do|your skills|all of your skills|capabilities|what types ads|how many ways.*metaads|able to do carousel ads)\b/.test(value);
}

function buildCapabilityResponse(userRequest = '') {
    const value = String(userRequest || '').toLowerCase();

    if (/\bmetaads\b/.test(value) && /\bhow many ways\b/.test(value)) {
        return buildMetaWaysSummary();
    }

    if ((/\bmetaads\b/.test(value) || /\bfacebook|instagram|meta\b/.test(value)) && /\bwhat types ads\b/.test(value)) {
        return buildMetaTypesSummary();
    }

    if (/\bcarousel\b/.test(value)) {
        return 'Not as a verified organic Meta tool path right now. I can do supported single post/photo/video/reel publishing, and paid campaign objects. Carousel support should only be claimed after we implement and verify it.';
    }

    return buildCapabilitySummary();
}

module.exports = {
    isCapabilityQuestion,
    buildCapabilityResponse
};
