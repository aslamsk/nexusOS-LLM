const path = require('path');

function ensureOutputDir(taskDir, fallbackDir) {
    return taskDir || fallbackDir || process.cwd();
}

function extractFirstUrl(text = '') {
    const value = String(text || '');
    const match = value.match(/https?:\/\/[^\s<>"')]+/i);
    return match ? match[0] : null;
}

function hydrateToolCall(toolCall = {}, context = {}) {
    const name = String(toolCall?.name || '');
    const args = { ...(toolCall?.args || {}) };
    const outputDir = ensureOutputDir(context.taskDir, context.rootDir);

    if (name === 'generateImage') {
        if (typeof context.enrichCreativePrompt === 'function' && String(args.prompt || '').trim()) {
            args.prompt = context.enrichCreativePrompt('image', args.prompt);
        }
        if (!String(args.savePath || '').trim()) {
            args.savePath = path.join(outputDir, `generated_image_${Date.now()}.png`);
        }
        if (!String(args.aspectRatio || '').trim()) {
            args.aspectRatio = '1:1';
        }
        return { ...toolCall, args };
    }

    if (name === 'generateVideo') {
        if (typeof context.enrichCreativePrompt === 'function' && String(args.prompt || '').trim()) {
            args.prompt = context.enrichCreativePrompt('video', args.prompt);
        }
        if (!String(args.outputPath || '').trim()) {
            args.outputPath = path.join(outputDir, `generated_video_${Date.now()}.mp4`);
        }
        return { ...toolCall, args };
    }

    if (name === 'createAgencyQuoteArtifacts' || name === 'buildAgencyQuotePlan') {
        const defaults = typeof context.extractCommercialQuoteDefaults === 'function'
            ? context.extractCommercialQuoteDefaults(context.latestUser || context.taskObjective || '')
            : {};
        return {
            ...toolCall,
            args: {
                ...defaults,
                ...args
            }
        };
    }

    if (name === 'sendEmail') {
        if ((!Array.isArray(args.attachments) || !args.attachments.length) && context.currentMissionArtifact?.files?.pdf) {
            args.attachments = [{ filename: 'quote.pdf', path: context.currentMissionArtifact.files.pdf }];
        }
        return { ...toolCall, args };
    }

    if (name === 'metaAds' && /^publishOrganic/i.test(String(args.action || ''))) {
        const sourceText = context.taskObjective || context.latestUser || '';
        const extractedUrl = extractFirstUrl(sourceText);
        const hasExplicitImage = Boolean(String(args.imagePath || '').trim() || context.lastUploadedFile);
        if (!String(args.imagePath || '').trim() && context.lastUploadedFile) {
            args.imagePath = context.lastUploadedFile;
        }
        if (!String(args.message || '').trim() && context.currentOrganicMetaDraft?.message) {
            args.message = context.currentOrganicMetaDraft.message;
        }
        if (!String(args.message || '').trim() && context.currentOrganicMetaDraft?.title && context.currentOrganicMetaDraft?.description) {
            args.message = [
                context.currentOrganicMetaDraft.title,
                context.currentOrganicMetaDraft.description,
                context.currentOrganicMetaDraft.tags || ''
            ].filter(Boolean).join('\n\n');
        }
        if (!String(args.message || '').trim() && extractedUrl) {
            args.message = 'Watch this video and share your thoughts.';
        }
        if (!String(args.link || '').trim() && context.currentOrganicMetaDraft?.link) {
            args.link = context.currentOrganicMetaDraft.link;
        }
        if (!String(args.link || '').trim() && extractedUrl) {
            args.link = extractedUrl;
        }
        if (!Array.isArray(args.channels) && Array.isArray(context.currentOrganicMetaDraft?.channels)) {
            args.channels = context.currentOrganicMetaDraft.channels;
        }
        if (!Array.isArray(args.channels)) {
            args.channels = hasExplicitImage ? ['facebook', 'instagram'] : ['facebook'];
        }
        return { ...toolCall, args };
    }

    return { ...toolCall, args };
}

module.exports = {
    hydrateToolCall
};
