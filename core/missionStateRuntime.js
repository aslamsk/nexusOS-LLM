function buildDefaultMissionState() {
    return {
        pendingApproval: null,
        auditTrail: [],
        pendingRepair: null,
        recoveryHistory: [],
        currentMarketingWorkflow: null,
        pendingRequirement: null,
        pendingClarification: null,
        currentWorkflowState: null,
        currentMissionArtifact: null,
        missionArtifactHistory: [],
        pendingActionChain: [],
        lastPublishedTargets: [],
        activeMissionDomain: 'general',
        missionTaskStack: [],
        currentTaskContract: null,
        currentOrganicMetaDraft: null,
        lastMissionStatusSignature: null
    };
}

function buildStopState() {
    return {
        isStopped: true,
        isRunning: false,
        isWaitingForInput: false,
        pendingApproval: null,
        pendingRepair: null,
        pendingRequirement: null,
        pendingClarification: null
    };
}

function buildResetState(systemPrompt) {
    return {
        context: [{ role: 'system', content: systemPrompt }],
        currentClientId: null,
        currentMarketingWorkflow: null,
        currentOrganicMetaDraft: null,
        currentWorkflowState: null,
        currentMissionArtifact: null,
        missionArtifactHistory: [],
        pendingActionChain: [],
        lastPublishedTargets: [],
        activeMissionDomain: 'general',
        missionTaskStack: [],
        currentTaskContract: null,
        pendingClarification: null,
        isStopped: false,
        lastMissionStatusSignature: null
    };
}

function buildPersistentState(orchestrator) {
    return {
        context: orchestrator.context,
        lastUploadedFile: orchestrator.lastUploadedFile,
        stepCount: orchestrator.stepCount,
        currentClientId: orchestrator.currentClientId,
        currentMarketingWorkflow: orchestrator.currentMarketingWorkflow,
        missionMode: orchestrator.currentMissionMode,
        manualMissionMode: orchestrator.manualMissionMode,
        isWaitingForInput: orchestrator.isWaitingForInput,
        currentRun: orchestrator.currentRun,
        recentRuns: orchestrator.recentRuns,
        currentOrganicMetaDraft: orchestrator.currentOrganicMetaDraft,
        currentWorkflowState: orchestrator.currentWorkflowState,
        currentMissionArtifact: orchestrator.currentMissionArtifact || null,
        missionArtifactHistory: orchestrator.missionArtifactHistory || [],
        pendingActionChain: orchestrator.pendingActionChain || [],
        lastPublishedTargets: orchestrator.lastPublishedTargets || [],
        activeMissionDomain: orchestrator.activeMissionDomain || 'general',
        missionTaskStack: orchestrator.missionTaskStack || [],
        pendingApproval: orchestrator.pendingApproval,
        pendingRequirement: orchestrator.pendingRequirement,
        pendingRepair: orchestrator.pendingRepair,
        auditTrail: orchestrator.auditTrail,
        recoveryHistory: orchestrator.recoveryHistory
    };
}

function restorePersistentState(orchestrator, state) {
    if (!state) return;
    if (state.context) orchestrator.context = state.context;
    if (state.lastUploadedFile) orchestrator.lastUploadedFile = state.lastUploadedFile;
    if (state.currentClientId !== undefined) orchestrator.currentClientId = state.currentClientId;
    if (state.currentMarketingWorkflow !== undefined) orchestrator.currentMarketingWorkflow = state.currentMarketingWorkflow;
    if (state.missionMode !== undefined) orchestrator.currentMissionMode = state.missionMode;
    if (state.manualMissionMode !== undefined) orchestrator.manualMissionMode = state.manualMissionMode;
    if (state.isWaitingForInput !== undefined) orchestrator.isWaitingForInput = state.isWaitingForInput;
    if (state.currentRun) orchestrator.currentRun = state.currentRun;
    if (state.recentRuns) orchestrator.recentRuns = state.recentRuns;
    if (state.currentOrganicMetaDraft) orchestrator.currentOrganicMetaDraft = state.currentOrganicMetaDraft;
    if (state.currentWorkflowState) orchestrator.currentWorkflowState = state.currentWorkflowState;
    if (state.currentMissionArtifact) orchestrator.currentMissionArtifact = state.currentMissionArtifact;
    if (state.missionArtifactHistory) orchestrator.missionArtifactHistory = state.missionArtifactHistory;
    if (state.pendingActionChain) orchestrator.pendingActionChain = state.pendingActionChain;
    if (state.lastPublishedTargets) orchestrator.lastPublishedTargets = state.lastPublishedTargets;
    if (state.activeMissionDomain) orchestrator.activeMissionDomain = state.activeMissionDomain;
    if (state.missionTaskStack) orchestrator.missionTaskStack = state.missionTaskStack;
    if (state.pendingApproval) orchestrator.pendingApproval = state.pendingApproval;
    if (state.pendingRequirement) orchestrator.pendingRequirement = state.pendingRequirement;
    if (state.pendingRepair) orchestrator.pendingRepair = state.pendingRepair;
    if (state.auditTrail) orchestrator.auditTrail = state.auditTrail;
    if (state.recoveryHistory) orchestrator.recoveryHistory = state.recoveryHistory;
}

module.exports = {
    buildDefaultMissionState,
    buildStopState,
    buildResetState,
    buildPersistentState,
    restorePersistentState
};
