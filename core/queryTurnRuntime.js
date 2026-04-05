const ConfigService = require('./config');
const UsageTracker = require('./usageTracker');

async function buildStateContext(orchestrator) {
    let stateContext = '';
    if (orchestrator.lastUploadedFile) {
        stateContext += `[CURRENT_SYSTEM_STATE] Active File Context: "${orchestrator.lastUploadedFile}". If a user says "improve this", "run this", "change this", or "promote this", ALWAYS assume they mean this file.\n\n`;
    }
    stateContext += orchestrator._buildMissionMemoryContext();
    stateContext += orchestrator._buildTaskContractPrompt();

    const allConfigs = await ConfigService.getAll();
    const activeRules = Object.entries(allConfigs)
        .filter(([k, v]) => k.startsWith('TOOL_') && k.endsWith('_RULES') && v)
        .map(([k, v]) => `- ${k.replace('TOOL_', '').replace('_RULES', '')}: ${v}`);

    if (activeRules.length > 0) {
        stateContext += `[CAPABILITY DIRECTIVES & USER RULES]\nYou MUST strictly adhere to the following customized behavioral rules when utilizing capabilities:\n${activeRules.join('\n')}\n`;
    }
    return stateContext;
}

function applyStateContext(orchestrator, stateContext) {
    if (!stateContext) return;
    const systemIdx = orchestrator.context.findIndex((m) => m.role === 'system');
    if (systemIdx !== -1) {
        orchestrator.context[systemIdx].content = orchestrator.systemPrompt + '\n\n' + stateContext;
    }
}

async function getTurnResponse(orchestrator, consecutiveEmptyResponses = 0, maxConsecutiveEmpty = 3) {
    if (orchestrator.currentRun) orchestrator.currentRun.llmCalls += 1;
    const turnId = orchestrator.context.length + 1;
    console.log(`[Orchestrator] Starting Mission Turn #${turnId}... (Context: ${orchestrator.context.length} msgs)`);
    orchestrator.onUpdate({ type: 'thought', message: `🔍 **Nexus is thinking...** (Turn #${turnId})` });

    let response;
    try {
        const llmContext = orchestrator._trimContextForLlm(orchestrator.context);
        response = await orchestrator.llmService.generateResponse(llmContext, orchestrator._getLlmOptionsForCurrentMission());
    } catch (err) {
        const errMsg = err.message || '';
        const isEmptyOutputErr = errMsg.includes('model output must contain') || errMsg.includes('output text or tool calls') || errMsg.includes('both be empty');
        if (err.message?.includes('400') || err.message?.includes('thought_signature') || isEmptyOutputErr) {
            if (isEmptyOutputErr) {
                const nextCount = consecutiveEmptyResponses + 1;
                if (nextCount >= maxConsecutiveEmpty) {
                    orchestrator.onUpdate({ type: 'thought', message: `🛑 **Circuit Breaker:** The AI model returned empty responses ${maxConsecutiveEmpty} times. This is likely a content filtering or safety block. Please rephrase your request.` });
                    orchestrator._finishRun('completed');
                    return { stop: true, consecutiveEmptyResponses: nextCount };
                }
                response = { text: '⚠️ Empty model response detected. Retrying...', toolCall: null, provider: 'Gemini', model: 'unknown' };
                consecutiveEmptyResponses = nextCount;
            } else {
                console.error('[RESILIENCE] Signature Mismatch detected. Purging pinned key and retrying turn...');
                orchestrator.llmService.pinnedKeys?.delete(orchestrator.currentSessionId);
                const llmContext = orchestrator._trimContextForLlm(orchestrator.context);
                response = await orchestrator.llmService.generateResponse(llmContext, orchestrator._getLlmOptionsForCurrentMission());
            }
        } else {
            throw err;
        }
    }

    console.log(`[Orchestrator] Turn #${turnId} handled by ${response.provider}/${response.model}. (Text: ${!!response.text}, Tool: ${response.toolCall?.name || 'none'})`);

    if (!response.text && !response.toolCall) {
        consecutiveEmptyResponses += 1;
        console.warn(`[RESILIENCE] LLM returned completely empty response (${consecutiveEmptyResponses}/${maxConsecutiveEmpty}). Injecting fallback...`);
        if (consecutiveEmptyResponses >= maxConsecutiveEmpty) {
            orchestrator.onUpdate({ type: 'thought', message: `🛑 **Circuit Breaker:** The AI model returned empty responses ${maxConsecutiveEmpty} times in a row. This is likely a content filtering issue. Please rephrase your request.` });
            orchestrator._finishRun('completed');
            return { stop: true, consecutiveEmptyResponses };
        }
        response.text = 'I received an empty response. Could you please rephrase your request?';
    } else {
        consecutiveEmptyResponses = 0;
    }

    if (orchestrator.isStopped) return { stop: true, response, consecutiveEmptyResponses };

    if (orchestrator.currentRun) {
        const previousProvider = orchestrator.currentRun.lastLlmProvider;
        if (response.provider) orchestrator.currentRun.lastLlmProvider = response.provider;
        if (response.model) orchestrator.currentRun.lastLlmModel = response.model;
        if (previousProvider && response.provider && previousProvider !== response.provider) {
            orchestrator.currentRun.providerSwitches = orchestrator.currentRun.providerSwitches || [];
            orchestrator.currentRun.providerSwitches.push({
                at: new Date().toISOString(),
                from: previousProvider,
                to: response.provider,
                model: response.model || null
            });
        }
        if (response.provider || response.model) {
            const usageEvent = await UsageTracker.recordLlmUsage({
                provider: response.provider,
                model: response.model,
                clientId: orchestrator.currentClientId || null,
                sessionId: orchestrator.currentSessionId || null,
                runId: orchestrator.currentRun.id,
                requestPreview: orchestrator.currentRun.requestPreview,
                mode: orchestrator.currentMissionMode,
                inputTokens: response.usage?.inputTokens || 0,
                outputTokens: response.usage?.outputTokens || 0,
                totalTokens: response.usage?.totalTokens || 0
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
    }

    return { response, turnId, consecutiveEmptyResponses, stop: false };
}

module.exports = {
    buildStateContext,
    applyStateContext,
    getTurnResponse
};
