function extractPrimaryText(request = '') {
    const value = String(request || '').trim();
    const patterns = [
        /\bwith\s+the\s+text\s+["']?([^"'\n]+)["']?/i,
        /\btext\s*[:\-]?\s*["']?([^"'\n]+)["']?/i,
        /\bsaying\s+(?:that\s+)?["']?([^"'\n]+)["']?/i,
        /\bsay\s+["']?([^"'\n]+)["']?/i
    ];

    for (const pattern of patterns) {
        const match = value.match(pattern);
        if (match?.[1]) return match[1].trim();
    }
    return '';
}

function stripMediaVerbs(request = '') {
    return String(request || '')
        .replace(/\b(generate|create|make|design|produce|build)\b/gi, '')
        .replace(/\b(a|an)\b/gi, ' ')
        .replace(/\b(image|banner|poster|creative|thumbnail|logo|video|reel|promo|ad)\b/gi, ' ')
        .replace(/\bfor\s+saying\s+(that\s+)?["']?([^"'\n]+)["']?/gi, ' ')
        .replace(/\bwith\s+the\s+text\s+["']?([^"'\n]+)["']?/gi, ' ')
        .replace(/\btext\s*[:\-]?\s*["']?([^"'\n]+)["']?/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function shouldEnhancePrompt(prompt = '') {
    const value = String(prompt || '').trim();
    if (!value) return false;
    if (value.length > 220) return false;
    if (/cinematic|ultra|photorealistic|lighting|composition|typography|high contrast|4k|detailed/i.test(value)) return false;
    return /\b(generate|create|make|design)\b/i.test(value) || /\b(image|banner|poster|creative|thumbnail|video|reel)\b/i.test(value);
}

function buildImagePrompt(request = '') {
    const value = String(request || '').trim();
    if (!shouldEnhancePrompt(value)) return value;

    const primaryText = extractPrimaryText(value);
    const theme = stripMediaVerbs(value);
    const subjectLine = theme
        ? `Theme/context: ${theme}.`
        : 'Theme/context: festive social greeting.';

    const textLine = primaryText
        ? `Primary on-image text: "${primaryText}". Make the text clearly readable and beautifully styled.`
        : 'Include a short, prominent headline that matches the request.';

    return [
        'Create a polished social media greeting image.',
        subjectLine,
        textLine,
        'Use attractive composition, clean typography, high contrast, and a premium festive look.',
        'Make it feel like a finished shareable creative, not a plain illustration.'
    ].join(' ');
}

function buildVideoPrompt(request = '') {
    const value = String(request || '').trim();
    if (!shouldEnhancePrompt(value)) return value;

    const primaryText = extractPrimaryText(value);
    const theme = stripMediaVerbs(value);
    const themeLine = theme
        ? `Theme/context: ${theme}.`
        : 'Theme/context: promotional social media video.';

    const textLine = primaryText
        ? `Include clear on-screen text reading "${primaryText}".`
        : 'Use short, readable on-screen text that matches the request.';

    return [
        'Create a short, polished social media video concept.',
        themeLine,
        textLine,
        'Use visually appealing scenes, clear pacing, and a premium promotional finish.'
    ].join(' ');
}

function enrichCreativePrompt(type = 'image', request = '') {
    return String(type).toLowerCase() === 'video'
        ? buildVideoPrompt(request)
        : buildImagePrompt(request);
}

module.exports = {
    extractPrimaryText,
    shouldEnhancePrompt,
    buildImagePrompt,
    buildVideoPrompt,
    enrichCreativePrompt
};
