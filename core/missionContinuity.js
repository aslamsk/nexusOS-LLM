const path = require('path');

function isMissionFollowUpRequest({
    text = '',
    currentMissionArtifact = null,
    lastPublishedTargets = [],
    pendingActionChain = [],
    missionTaskStack = [],
    currentWorkflowState = null,
    currentRun = {},
    shouldForceBrowserContinuation = false
} = {}) {
    const value = String(text || '').trim().toLowerCase();
    if (!value) return false;
    const hasMemory = Boolean(
        currentMissionArtifact?.id ||
        lastPublishedTargets?.length ||
        pendingActionChain?.length ||
        missionTaskStack?.length ||
        currentWorkflowState ||
        currentRun?.toolsUsed?.browserAction
    );
    if (!hasMemory) return false;

    if (['continue', 'proceed', 'resume', 'go on', 'next', 'carry on'].includes(value) && shouldForceBrowserContinuation) {
        return true;
    }

    const directFollowUp = /\b(this|that|same|current|latest|previous|above|it)\b/.test(value);
    const mutateIntent = /\b(update|edit|modify|revise|change|delete|remove|send|share|publish|post|promote|continue|resume|reuse|adapt|repurpose|use)\b/.test(value);
    const crossDomainIntent = /\bfacebook|instagram|meta|linkedin|x|twitter|google|whatsapp|email|quote|quotation|video|image|creative|caption|content|code|bug|feature\b/.test(value);
    return (directFollowUp && mutateIntent) || (mutateIntent && crossDomainIntent);
}

function augmentFollowUpRequest({
    text = '',
    currentMissionArtifact = null,
    lastPublishedTargets = [],
    pendingActionChain = []
} = {}) {
    const value = String(text || '').trim();
    if (!value) return value;
    const parts = [];
    const artifact = currentMissionArtifact;
    const latestTarget = Array.isArray(lastPublishedTargets) ? lastPublishedTargets[0] : null;
    const queued = Array.isArray(pendingActionChain) ? pendingActionChain[0] : null;

    parts.push('[FOLLOW-UP MISSION CONTEXT]');
    if (artifact) {
        parts.push('Current artifact kind: ' + (artifact.kind || 'file'));
        if (artifact.path) parts.push('Current artifact path: ' + artifact.path);
        if (artifact.url) parts.push('Current artifact url: ' + artifact.url);
        if (artifact.files?.pdf) parts.push('Current artifact pdf: ' + artifact.files.pdf);
    }
    if (latestTarget) {
        const latestTargetUrl = latestTarget?.id && /^https?:/i.test(String(latestTarget.id)) ? latestTarget.id : (latestTarget?.details?.url || latestTarget?.details?.postUrl || null);
        parts.push('Latest published target channel: ' + (latestTarget.channel || 'unknown'));
        parts.push('Latest published target id: ' + (latestTarget.id || 'unknown'));
        parts.push('Latest published target action: ' + (latestTarget.action || 'unknown'));
        if (latestTargetUrl) parts.push('Latest published target url: ' + latestTargetUrl);
    }
    if (queued) {
        parts.push('Queued next action: ' + queued.type + ' on ' + (queued.channel || 'general'));
    }
    parts.push('Interpret references like this, that, it, same, current, and latest against this mission context first.');
    parts.push('If the Boss asks to delete or remove a published item, resolve against the latest published target first.');
    parts.push('If the Boss asks to send or share a quote, reuse the latest quote bundle files first.');
    parts.push('If the Boss asks to publish, promote, or adapt content, reuse the latest artifact first.');
    parts.push('Boss request: ' + value);
    return parts.join('\n');
}

function resolveLatestTargetId(lastPublishedTargets = [], channel = '') {
    const normalized = String(channel || '').trim().toLowerCase();
    const targets = Array.isArray(lastPublishedTargets) ? lastPublishedTargets : [];
    const match = normalized ? targets.find((item) => String(item.channel || '').toLowerCase() === normalized) : targets[0];
    return match?.id || null;
}

function registerMissionTarget(lastPublishedTargets = [], details = {}, currentMissionArtifact = null) {
    const target = {
        id: details.id || `target_${Date.now()}`,
        channel: details.channel || details.domain || 'general',
        type: details.type || 'external_target',
        action: details.action || '',
        status: details.status || 'completed',
        details: details.details || null,
        artifactId: details.artifactId || currentMissionArtifact?.id || null,
        createdAt: new Date().toISOString()
    };
    const nextTargets = Array.isArray(lastPublishedTargets) ? [...lastPublishedTargets] : [];
    nextTargets.unshift(target);
    return {
        target,
        targets: nextTargets.slice(0, 8)
    };
}

function createOutputUrlFromPath(filePath, taskDir = '') {
    const absolutePath = String(filePath || '').trim();
    if (!absolutePath || !taskDir) return null;
    const normalizedTaskDir = path.resolve(taskDir);
    const normalizedPath = path.resolve(absolutePath);
    if (!normalizedPath.startsWith(normalizedTaskDir)) return null;
    const folderName = path.basename(taskDir);
    const relativePath = path.relative(taskDir, normalizedPath).split(path.sep).map(encodeURIComponent).join('/');
    return `/outputs/${folderName}/${relativePath}`;
}

function registerMissionArtifact({
    currentMissionArtifact = null,
    missionArtifactHistory = [],
    lastUploadedFile = null,
    taskDir = '',
    details = {}
} = {}) {
    const artifact = {
        id: `artifact_${Date.now()}`,
        kind: details.kind || 'file',
        path: details.path || null,
        url: details.url || createOutputUrlFromPath(details.path, taskDir),
        files: details.files || null,
        prompt: details.prompt || '',
        sourceTool: details.sourceTool || '',
        aspectRatio: details.aspectRatio || null,
        createdAt: new Date().toISOString()
    };
    const nextHistory = Array.isArray(missionArtifactHistory) ? [...missionArtifactHistory] : [];
    nextHistory.unshift(artifact);
    return {
        artifact,
        history: nextHistory.slice(0, 12),
        lastUploadedFile: artifact.path || lastUploadedFile || null
    };
}

module.exports = {
    isMissionFollowUpRequest,
    augmentFollowUpRequest,
    resolveLatestTargetId,
    registerMissionTarget,
    createOutputUrlFromPath,
    registerMissionArtifact
};
