const path = require('path');

async function withTimeout(promise, timeoutMs, label) {
    let timer = null;
    try {
        return await Promise.race([
            promise,
            new Promise((resolve) => {
                timer = setTimeout(() => resolve(`Error: ${label} timed out after ${timeoutMs}ms`), timeoutMs);
            })
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function executeBrowserAction(args = {}, deps = {}) {
    const normalizedBrowserArgs = { ...(args || {}) };
    if (!String(normalizedBrowserArgs.action || '').trim()) {
        normalizedBrowserArgs.action = normalizedBrowserArgs.url ? 'open' : 'getMarkdown';
    }

    const result = await deps.browserAction(normalizedBrowserArgs);
    const visualActions = ['open', 'click', 'clickPixel', 'type', 'keyPress', 'clickText', 'scroll', 'hover'];
    if (visualActions.includes(normalizedBrowserArgs.action) && deps.taskDir && typeof deps.browserAction === 'function' && typeof deps.onUpdate === 'function') {
        const screenshotName = `screenshot_${Date.now()}.png`;
        const screenshotPath = path.join(deps.taskDir, screenshotName);
        await deps.browserAction({ action: 'annotateAndScreenshot', savePath: screenshotPath });
        const folderName = path.basename(deps.taskDir);
        deps.onUpdate({ type: 'thought', message: `Browser Update:\n![Browser View](/outputs/${folderName}/${screenshotName})` });
    }
    return result;
}

async function executeAdsAction(name, args = {}, deps = {}) {
    if (name === 'metaAds') {
        const dangerous = ['createCampaign', 'createAdSet', 'createAdCreative', 'createAd', 'publishOrganicPost', 'publishOrganicPhoto', 'publishOrganicVideo', 'publishOrganicReel'];
        if (dangerous.includes(args.action) && args.boss_approved !== true) {
            return 'MISSION BREACH: Dangerous action attempted without approval.';
        }
    }
    return deps.runAdsTool(name, args);
}

async function executeMediaAction(name, args = {}, deps = {}) {
    const mediaTimeoutMs = Number(deps.mediaTimeoutMs || 45000);
    if (name === 'generateImage') {
        const resolvedSavePath = args.savePath || path.join(deps.taskDir || deps.rootDir, `generated_image_${Date.now()}.png`);
        const result = await withTimeout(
            deps.generateImage(args.prompt, resolvedSavePath, { aspectRatio: args.aspectRatio, refine: args.refine }),
            mediaTimeoutMs,
            'generateImage'
        );
        if (!String(result).toLowerCase().startsWith('error')) {
            await deps.recordMediaUsage('Gemini', 'imagen-4.0-generate-001', 'free', 0);
            deps.registerMissionArtifact({
                kind: 'image',
                path: resolvedSavePath,
                prompt: args.prompt,
                sourceTool: 'generateImage',
                aspectRatio: args.aspectRatio || null
            });
        }
        return result;
    }

    if (name === 'generateVideo') {
        const resolvedOutputPath = args.outputPath || path.join(deps.taskDir || deps.rootDir, `generated_video_${Date.now()}.mp4`);
        if (args.prompt && !args.imagePath) {
            const veo = await withTimeout(
                deps.generateVideoWithVeo(args.prompt, resolvedOutputPath),
                mediaTimeoutMs,
                'generateVideo'
            );
            if (!veo.error) return `SUCCESS: Video created via Veo at ${resolvedOutputPath}`;
            const repl = await withTimeout(
                deps.generateVideoFromPrompt(args.prompt, resolvedOutputPath),
                mediaTimeoutMs,
                'generateVideo'
            );
            if (!repl.error) return `SUCCESS: Video created via Replicate at ${resolvedOutputPath}`;
        }
        return withTimeout(
            deps.imageToVideo(args.imagePath, resolvedOutputPath),
            mediaTimeoutMs,
            'imageToVideo'
        );
    }

    return null;
}

async function executeGenericTool(name, args = {}, deps = {}) {
    if (!deps.tools || !deps.tools[name]) return null;
    try {
        return await deps.tools[name](args);
    } catch (error) {
        if (typeof deps.runLegacyFallback === 'function') {
            return deps.runLegacyFallback(name, args, error);
        }
        throw error;
    }
}

module.exports = {
    executeBrowserAction,
    executeAdsAction,
    executeMediaAction,
    executeGenericTool
};
