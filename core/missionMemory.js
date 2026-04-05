const ToolEvidenceRuntime = require('./toolEvidenceRuntime');

function buildMissionMemoryContext({
    activeMissionDomain = 'general',
    currentMissionArtifact = null,
    lastPublishedTargets = [],
    missionTaskStack = [],
    pendingActionChain = []
} = {}) {
    const sections = [];
    sections.push(`[MISSION DOMAIN]\nCurrent active domain: ${activeMissionDomain || 'general'}\nWhen the Boss jumps to another task, preserve the latest artifact/target memory and adapt instead of pretending the previous task never happened.\n`);
    if (currentMissionArtifact?.path || currentMissionArtifact?.url) {
        sections.push(`[MISSION ARTIFACT]\nCurrent artifact kind: ${currentMissionArtifact.kind || 'file'}\nCurrent artifact path: ${currentMissionArtifact.path || 'n/a'}\nCurrent artifact url: ${currentMissionArtifact.url || 'n/a'}\nSource tool: ${currentMissionArtifact.sourceTool || 'unknown'}\nIf the Boss says "use this", "promote this", "update this", "modify this", or "delete this", assume they mean this artifact first.\n`);
    }
    if (lastPublishedTargets?.length) {
        const latest = lastPublishedTargets[0];
        sections.push(`[PUBLISHED TARGET]\nLatest published channel: ${latest.channel || 'unknown'}\nLatest published id: ${latest.id || 'unknown'}\nTarget type: ${latest.type || 'published_output'}\nIf the Boss asks to update/delete/remove the published content, resolve it against this target first.\n`);
    }
    if (missionTaskStack?.length) {
        const stackSummary = missionTaskStack.slice(0, 6)
            .map((item, index) => `${index + 1}. ${item.domain} :: ${item.label}`)
            .join('\n');
        sections.push(`[RECENT TASK MEMORY]\n${stackSummary}\n`);
    }
    if (pendingActionChain?.length) {
        const queueSummary = pendingActionChain
            .map((item, index) => `${index + 1}. ${item.type} [${item.status}]`)
            .join('\n');
        sections.push(`[QUEUED NEXT ACTIONS]\n${queueSummary}\nAfter completing the current step, ask for approval before executing the next queued risky step.\n`);
    }
    return sections.length ? `${sections.join('\n')}` : '';
}

function classifyMissionDomain(toolCall = {}) {
    const name = String(toolCall?.name || '').toLowerCase();
    const action = String(toolCall?.args?.action || '').toLowerCase();
    if (name.includes('meta') || name.includes('googleads') || name.includes('linkedin') || name.includes('xads') || action.includes('campaign') || action.includes('publish')) return 'marketing';
    if (name === 'generateimage' || name === 'generatevideo' || name === 'removebg') return 'media';
    if (name === 'readfile' || name === 'writefile' || name === 'replacefilecontent' || name === 'multireplacefilecontent' || name === 'runcommand' || name === 'codemap' || name === 'codesearch' || name === 'codefindfn') return 'development';
    if (name === 'createagencyquoteartifacts' || name === 'buildagencyquoteplan') return 'commercial';
    if (name === 'sendemail' || name === 'reademail' || name === 'sendwhatsapp' || name === 'sendwhatsappmedia') return 'communications';
    if (name === 'browseraction') return 'browser';
    if (name === 'searchweb') return 'research';
    return 'general';
}

function pushMissionTask(missionTaskStack = [], activeMissionDomain = 'general', domain, label) {
    const nextStack = Array.isArray(missionTaskStack) ? [...missionTaskStack] : [];
    nextStack.unshift({
        domain: domain || 'general',
        label: String(label || 'Task').slice(0, 180),
        at: new Date().toISOString()
    });
    return {
        missionTaskStack: nextStack.slice(0, 12),
        activeMissionDomain: domain || activeMissionDomain || 'general'
    };
}

function captureToolOutcome({
    toolCall,
    result,
    formatToolResult,
    registerMissionArtifact,
    registerMissionTarget,
    resolveLatestTargetId,
    pendingActionChain = [],
    setWaitingForInput,
    onUpdate,
    pushMissionTaskState
} = {}) {
    const name = String(toolCall?.name || '');
    const action = String(toolCall?.args?.action || '');
    const domain = classifyMissionDomain(toolCall);
    if (typeof pushMissionTaskState === 'function') {
        pushMissionTaskState(domain, `${name}${action ? `:${action}` : ''}`);
    }

    const plan = ToolEvidenceRuntime.extractToolOutcomePlan({
        toolCall,
        result,
        formatToolResult,
        pendingActionChain,
        resolveLatestTargetId
    });

    if (plan.artifact) {
        registerMissionArtifact(plan.artifact);
    }

    if (plan.target) {
        registerMissionTarget({
            ...plan.target,
            domain
        });
    }

    if (plan.queueUpdate?.type === 'await_boss' && pendingActionChain?.length && pendingActionChain[0]?.status === 'pending_confirmation') {
        pendingActionChain[0].status = 'awaiting_boss';
        if (typeof setWaitingForInput === 'function') setWaitingForInput(true);
        if (typeof onUpdate === 'function') {
            onUpdate({
                type: 'input_requested',
                message: plan.queueUpdate.message
            });
        }
    }

    if (plan.queueUpdate?.type === 'consume_first' && pendingActionChain?.length && pendingActionChain[0]?.type === 'promote_generated_asset') {
        pendingActionChain.shift();
    }
}

module.exports = {
    buildMissionMemoryContext,
    classifyMissionDomain,
    pushMissionTask,
    captureToolOutcome
};
