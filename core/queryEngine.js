const MemoryService = require('./memory');
const MarketingService = require('./marketing');
const MarketingPrompts = require('./marketingPrompts');
const GoalInterpreter = require('./goalInterpreter');
const MissionMode = require('./missionMode');
const UsageTracker = require('./usageTracker');
const SkillReaderTool = require('../tools/skillReader');
const PreflightPlanRuntime = require('./preflightPlanRuntime');

async function prepareMissionBootstrap(orchestrator, userRequest) {
    const isMissionFollowUp = orchestrator._isMissionFollowUpRequest(userRequest);
    const augmentedRequest = isMissionFollowUp ? orchestrator._augmentFollowUpRequest(userRequest) : userRequest;
    orchestrator._beginRun(augmentedRequest);

    if (orchestrator._isCapabilityQuestion(augmentedRequest)) {
        const reply = orchestrator._buildCapabilityResponse(augmentedRequest);
        orchestrator.onUpdate({ type: 'complete', message: reply });
        orchestrator.context = [{ role: 'system', content: orchestrator.systemPrompt }, { role: 'assistant', content: reply }];
        orchestrator._finishRun('completed');
        orchestrator.isRunning = false;
        return { handled: true, augmentedRequest, isMissionFollowUp };
    }

    if (orchestrator._applyWorkflowIntent(augmentedRequest)) {
        orchestrator._beginRun(augmentedRequest);
    }

    orchestrator.context = [{ role: 'system', content: orchestrator.systemPrompt }];
    orchestrator.currentTaskContract = orchestrator._buildTaskContract(augmentedRequest);
    orchestrator.activeMissionDomain = orchestrator.currentTaskContract?.routingProfile?.domain || 'general';
    if (orchestrator.currentTaskContract?.routingProfile) {
        const routing = orchestrator.currentTaskContract.routingProfile;
        const preferredTools = Array.isArray(routing.preferredTools) && routing.preferredTools.length
            ? routing.preferredTools.join(', ')
            : 'general reasoning';
        orchestrator.onUpdate({
            type: 'thought',
            message: `Task routing locked: domain=${routing.domain || 'general'} | preferred tools=${preferredTools}`
        });
        orchestrator.onUpdate({
            type: 'thought',
            message: PreflightPlanRuntime.buildPreflightMessage(routing.domain || 'general', augmentedRequest)
        });
        const missingInputs = PreflightPlanRuntime.detectMissingInputs(routing.domain || 'general', augmentedRequest);
        if (missingInputs.length) {
            const prompt = `Before execution I still need: ${missingInputs.join(', ')}. Reply with only those missing details and Nexus will continue the task.`;
            orchestrator.pendingClarification = {
                question: prompt,
                normalized: orchestrator._normalizeClarificationQuestion(prompt),
                requestedAt: new Date().toISOString()
            };
            orchestrator.onUpdate({ type: 'input_requested', message: prompt });
            orchestrator.isWaitingForInput = true;
            orchestrator._finishRun('paused');
            orchestrator.isRunning = false;
            return { handled: true, augmentedRequest, isMissionFollowUp };
        }
    }

    if (!orchestrator._isOrganicPublishIntent(augmentedRequest)) {
        orchestrator.currentOrganicMetaDraft = null;
        orchestrator.currentWorkflowState = null;
        orchestrator.currentMarketingWorkflow = null;
        orchestrator.pendingActionChain = orchestrator._inferQueuedActionsFromRequest(augmentedRequest);
        if (!orchestrator.pendingActionChain.length && !isMissionFollowUp) {
            orchestrator.currentMissionArtifact = null;
            orchestrator.missionArtifactHistory = [];
            orchestrator.lastPublishedTargets = [];
        }
    }

    const isBrowserMission = orchestrator._isBrowserMissionRequest(augmentedRequest);
    const primaryDomain = String(orchestrator.currentTaskContract?.routingProfile?.domain || 'general').toLowerCase();
    const shouldRecallLongTermMemory = orchestrator._shouldRecallLongTermMemory(primaryDomain);

    const memories = shouldRecallLongTermMemory ? await MemoryService.recallRecent(5) : [];
    const recoveryPatterns = shouldRecallLongTermMemory ? await MemoryService.findRecoveryPatterns(augmentedRequest, 3) : [];
    const detectedMarketingWorkflow = (!isBrowserMission && orchestrator._shouldInjectMarketingWorkflow(primaryDomain))
        ? MarketingService.detectWorkflowFromText(augmentedRequest)
        : null;
    const detectedGoal = GoalInterpreter.interpretGoal(augmentedRequest);
    const detectedCommercialQuote = orchestrator._detectCommercialQuoteRequest(augmentedRequest);
    orchestrator.currentMissionMode = MissionMode.detectMissionMode(augmentedRequest, orchestrator.manualMissionMode);
    orchestrator._emitMissionStatus('routing', 'Mission mode and domain locked for this request.', {
        mode: orchestrator.currentMissionMode,
        domain: orchestrator.activeMissionDomain,
        request: augmentedRequest
    });
    orchestrator.currentMarketingWorkflow = detectedMarketingWorkflow ? detectedMarketingWorkflow.id : null;

    let memoryPrompt = '';
    memoryPrompt += MissionMode.buildModePrompt(orchestrator.currentMissionMode);
    memoryPrompt += orchestrator._buildExecutionProtocol(augmentedRequest);
    if (memories.length > 0) {
        memoryPrompt += `### LONG-TERM MEMORY RECALL:\n${memories.map((m) => `- ${m}`).join('\n')}\n\n`;
    }
    if (recoveryPatterns.length > 0) {
        memoryPrompt += `### RECOVERY PATTERN RECALL:\n${recoveryPatterns.map((p, idx) => `${idx + 1}. Tool: ${p.tool} | Failure: ${p.classification} | Successful response: ${p.resolution || p.playbook || p.summary}`).join('\n')}\n\n`;
    }
    if (detectedMarketingWorkflow) {
        const packId = ['audit', 'copy', 'ads', 'report'].includes(detectedMarketingWorkflow.id) ? detectedMarketingWorkflow.id : 'report';
        memoryPrompt += `${MarketingPrompts.buildPromptContext(packId, detectedMarketingWorkflow)}\n\n`;
        if (detectedMarketingWorkflow.id === 'ads') {
            memoryPrompt += `${MarketingPrompts.buildAdsExecutionContext(augmentedRequest)}\n\n`;
        }
        memoryPrompt += `### MARKETING SPECIALISTS\n${detectedMarketingWorkflow.specialists.map((item) => `- ${item}`).join('\n')}\n\n`;
        if (detectedMarketingWorkflow.id === 'audit') {
            memoryPrompt += `${MarketingPrompts.buildAuditBundleContext({
                workflow: detectedMarketingWorkflow,
                target: '',
                clientName: '',
                notes: '',
                budget: '',
                channels: []
            })}\n\n`;
        }
    }
    if (detectedGoal) {
        memoryPrompt += `### GOAL INTERPRETER\n${GoalInterpreter.buildExecutionBrief(detectedGoal)}\n\n`;
        orchestrator.onUpdate({
            type: 'thought',
            message: `Goal detected: ${detectedGoal.targetValue} ${detectedGoal.metricLabel} via ${detectedGoal.channels.join(', ')}. Nexus is expanding the Boss request into an execution plan.`
        });
    }
    if (detectedCommercialQuote) {
        const quoteDefaults = orchestrator._extractCommercialQuoteDefaults(augmentedRequest);
        memoryPrompt += `### COMMERCIAL QUOTE INTERPRETER
COMMERCIAL QUOTE REQUEST DETECTED.
- Do not use web search or browser research unless the Boss explicitly asks for benchmarking.
- Use agency quote planning directly.
- Build a commercial quote for recurring work using the commercial quote tools.
- Include AI/model cost after free-tier exhaustion, agency profit, and export-ready documents.
- Prefer generating PDF/CSV/Markdown quote artifacts in the current task folder.
- If client identity is missing, use a generic client label and continue.
Suggested defaults:
${JSON.stringify(quoteDefaults, null, 2)}

`;
        orchestrator.onUpdate({
            type: 'thought',
            message: 'Commercial quote request detected. Nexus is switching to direct finance planning instead of search.'
        });
    }

    const skillSearchRequest = String(userRequest || '');
    const shouldAutoLoadSkill = orchestrator._shouldAutoLoadSpecialistSkill(skillSearchRequest, primaryDomain);
    const suggestedSkills = shouldAutoLoadSkill ? SkillReaderTool.findBestSkill(userRequest) : [];
    let expertRolePrompt = '';

    if (!isBrowserMission && suggestedSkills.length > 0) {
        const bestSkill = suggestedSkills[0];
        const playbook = SkillReaderTool.readSkill(bestSkill);
        const roleName = bestSkill.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        orchestrator.onUpdate({ type: 'thought', message: `🧩 **Expert Alignment:** Activating the [${roleName}] specialist persona from standard agency playbook @${bestSkill}.` });

        expertRolePrompt = `### EXPERT ROLE ASSUMPTION\nYou are now acting as the **Elite ${roleName} Specialist** for Nexus OS. 
You must strictly adhere to the following expert playbook and Standard Operating Procedures (SOPs):
${playbook}\n\n`;
    }

    const missionDirective = orchestrator.currentMissionMode === 'execute'
        ? '\n\n### MISSION DIRECTIVE\nYou are in EXECUTE mode. Act decisively, but do not rush into unrelated tools. Re-state the exact requested outcome internally, choose only tools that directly advance it, and stop side quests. Your specialist persona is secondary to task relevance and delivery.'
        : '';

    const executionPrompt = expertRolePrompt + memoryPrompt + augmentedRequest + missionDirective;
    orchestrator.context.push({ role: 'user', content: executionPrompt });

    return {
        handled: false,
        augmentedRequest,
        isMissionFollowUp,
        isBrowserMission,
        primaryDomain,
        executionPrompt
    };
}

module.exports = {
    prepareMissionBootstrap,
    async runExecuteLoop(orchestrator, originalRequest = null) {
        return orchestrator._runLoopCore(originalRequest);
    },
    async runChatLoop(orchestrator, originalRequest = null) {
        if (orchestrator.currentRun) orchestrator.currentRun.llmCalls += 1;
        const llmContext = orchestrator._trimContextForLlm(orchestrator.context);
        orchestrator._emitMissionStatus('llm_wait', 'Waiting for model response in chat mode.', {
            mode: 'chat',
            domain: orchestrator.activeMissionDomain,
            waitingFor: 'llm_response'
        });
        const response = await orchestrator.llmService.generateResponse(llmContext, { mode: 'chat', enableTools: false });
        if (orchestrator.isStopped) return;

        if (orchestrator.currentRun) {
            if (response.provider) orchestrator.currentRun.lastLlmProvider = response.provider;
            if (response.model) orchestrator.currentRun.lastLlmModel = response.model;
            const usage = response.usage || {};
            const usageEvent = await UsageTracker.recordLlmUsage({
                provider: response.provider,
                model: response.model,
                clientId: orchestrator.currentClientId || null,
                sessionId: orchestrator.currentSessionId || null,
                runId: orchestrator.currentRun.id,
                requestPreview: orchestrator.currentRun.requestPreview,
                mode: 'chat',
                inputTokens: usage.inputTokens || 0,
                outputTokens: usage.outputTokens || 0,
                totalTokens: usage.totalTokens || 0
            });
            const usageKey = `${usageEvent.provider}::${usageEvent.model}`;
            const currentEntry = orchestrator.currentRun.providerUsage?.[usageKey] || {
                provider: usageEvent.provider,
                model: usageEvent.model,
                calls: 0,
                freeCalls: 0,
                paidCalls: 0,
                estimatedCostUsd: 0,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0
            };
            currentEntry.calls += 1;
            currentEntry.freeCalls += usageEvent.usageTier === 'free' ? 1 : 0;
            currentEntry.paidCalls += usageEvent.usageTier === 'paid' ? 1 : 0;
            currentEntry.estimatedCostUsd = Number((currentEntry.estimatedCostUsd + Number(usageEvent.estimatedCostUsd || 0)).toFixed(6));
            currentEntry.inputTokens += Number(usageEvent.inputTokens || 0);
            currentEntry.outputTokens += Number(usageEvent.outputTokens || 0);
            currentEntry.totalTokens += Number(usageEvent.totalTokens || 0);
            orchestrator.currentRun.providerUsage = orchestrator.currentRun.providerUsage || {};
            orchestrator.currentRun.providerUsage[usageKey] = currentEntry;
        }

        const text = String(response.text || '').trim() || 'No response generated.';
        orchestrator.onUpdate({ type: 'thought', message: text });
        orchestrator.context.push({ role: 'assistant', content: text });

        const textLower = text.toLowerCase();
        const isAskingQuestion = textLower.includes('?') ||
            textLower.includes('please provide') ||
            textLower.includes('i need your') ||
            textLower.includes('tell me');

        if (isAskingQuestion) {
            orchestrator.onUpdate({ type: 'pause' });
            orchestrator.isWaitingForInput = true;
            orchestrator._finishRun('paused');
            return;
        }

        orchestrator.onUpdate({ type: 'complete', message: 'Chat response complete.' });
        orchestrator._finishRun('completed');
    }
};
