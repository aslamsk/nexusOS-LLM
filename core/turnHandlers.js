const SkillReaderTool = require('../tools/skillReader');

async function handleAssistantText(orchestrator, response, originalRequest) {
    if (!response?.text) {
        return { paused: false };
    }

    const organicDraft = orchestrator._extractOrganicMetaDraft(response.text);
    if (organicDraft) {
        orchestrator.currentOrganicMetaDraft = organicDraft;
        orchestrator._setWorkflowState({
            domain: 'marketing',
            channel: 'meta',
            mode: 'organic_publish',
            stage: 'draft_ready'
        });
        orchestrator._recordAudit('organic_meta_draft_prepared', {
            link: organicDraft.link,
            cta: organicDraft.cta,
            title: organicDraft.title
        });
    }

    if (response.text.startsWith('MISSION BREACH:')) {
        orchestrator.onUpdate({ type: 'error', message: response.text });
    } else if (response.text.trim()) {
        orchestrator.onUpdate({ type: 'thought', message: response.text });
    }

    orchestrator.context.push({
        role: 'assistant',
        content: response.text,
        parts: response.parts
    });

    if (organicDraft && orchestrator._shouldAutoRequestOrganicApproval(originalRequest || orchestrator.context.find((m) => m.role === 'user')?.content || '', response.text)) {
        if (await orchestrator._queueOrganicDraftApprovalFromDraft()) {
            orchestrator._finishRun('paused');
            return { paused: true };
        }
    }

    return { paused: false, organicDraft };
}

async function executeToolTurn(orchestrator, response) {
    if (orchestrator.isStopped) return { stopped: true };

    orchestrator.onUpdate({
        type: 'action',
        name: response.toolCall.name,
        args: response.toolCall.args
    });
    const engineNote = await orchestrator._describeExecutionEngine(response.toolCall);
    if (engineNote) {
        orchestrator.onUpdate({ type: 'thought', message: engineNote });
    }

    orchestrator.context.push({
        role: 'assistant',
        content: response.text || '',
        toolCall: response.toolCall,
        parts: response.parts
    });

    orchestrator.onUpdate({ type: 'thought', message: `🛠️ **[${response.provider || 'AI'}/${response.model || 'Brain'}] Calling tool:** ${response.toolCall.name}` });

    if (response.toolCall.name === 'askUserForInput') {
        const question = String(response.toolCall.args.question || '').trim();
        const clarificationDecision = orchestrator._shouldAskClarification(question);
        if (!clarificationDecision.allow) {
            orchestrator.context.push({
                role: 'user',
                content: 'SYSTEM CORRECTION: Do not repeat the same clarification request. Either continue with the information already available or ask one different, more specific missing-field question only if absolutely necessary.'
            });
            return { needsContinue: true };
        }
        orchestrator.pendingClarification = {
            question,
            normalized: orchestrator._normalizeClarificationQuestion(question),
            requestedAt: new Date().toISOString()
        };
        orchestrator.onUpdate({ type: 'input_requested', message: `💬 **[${response.provider || 'AI'}/${response.model || 'Brain'}] Internal Question:** ${question}` });
        orchestrator.isWaitingForInput = true;
        orchestrator._finishRun('paused');
        return { paused: true };
    }

    let result;
    try {
        result = await orchestrator.dispatchTool(response.toolCall);
        orchestrator.onUpdate({ type: 'thought', message: `✅ **Tool result received from ${response.toolCall.name}.**` });
    } catch (err) {
        orchestrator.onUpdate({ type: 'thought', message: `⚠️ Specialist Insight: An expert-level hurdle has been encountered in [${response.toolCall.name}].` });

        const troubleshootingSkills = SkillReaderTool.searchSkills(err.message + ' ' + response.toolCall.name);
        const skillContext = troubleshootingSkills.length > 0 ? `Relevant expert SOPs found for repair: ${troubleshootingSkills.join(', ')}` : 'No direct local repair SOP found.';

        const recoveryPrompt = `The system encountered a technical error: "${err.message}" while running the tool "${response.toolCall.name}". 
${skillContext}

As a professional expert, analyze this failure and propose 3 distinct ways the Boss can help me finish this task (e.g., provide a different API key, use a different tool, or manual workaround). Act like a pro employee-refer to alternatives and suggest how we can create it despite this hurdle.`;

        const recoveryReport = await orchestrator.llmService.generateResponse([{ role: 'user', content: recoveryPrompt }], { mode: 'chat' });
        result = `### SPECIALIST RECOVERY REPORT\n${recoveryReport.text || err.message}`;
        orchestrator.onUpdate({ type: 'thought', message: result });
    }

    if (orchestrator.isStopped) return { stopped: true };

    if (response.toolCall.name === 'browserAction' && ['open', 'click', 'clickText', 'keyPress'].includes(response.toolCall.args.action) && !String(result).toLowerCase().includes('error')) {
        await orchestrator.tools.browserAction({ action: 'dismissInterruptions' });
        orchestrator.onUpdate({ type: 'thought', message: `🔍 Auto-Sync: Page opened. Performing background 'getMarkdown' for immediate context...` });
        let pageContent = await orchestrator.tools.browserAction({ action: 'getMarkdown' });
        if (String(pageContent).toLowerCase().includes('error')) {
            await orchestrator.tools.browserAction({ action: 'waitForNetworkIdle', timeout: 3000 });
            const fallbackScan = await orchestrator.tools.browserAction({ action: 'extractActiveElements' });
            pageContent = `[getMarkdown failed, using fallback active-element scan]\n${fallbackScan}`;
        }
        result = `${result}\n\n[PROACTIVE PAGE SCAN]:\n${pageContent}`;
    }

    orchestrator._captureToolOutcome(response.toolCall, result);
    let resultString = orchestrator._formatToolResult(result);

    if (response.toolCall.name === 'browserAction' &&
        response.toolCall.args?.action === 'open' &&
        orchestrator._isCookiePolicyRedirect(resultString) &&
        orchestrator._shouldForceBrowserContinuation(orchestrator.currentTaskContract?.objective || orchestrator._getLatestUserText())) {
        orchestrator.onUpdate({
            type: 'thought',
            message: 'Browser redirected to a cookie/policy page. Nexus is forcing in-site recovery to reach the requested target page instead of reopening the same URL or drifting away from the browser flow.'
        });
        orchestrator.context.push({
            role: 'user',
            content: 'SYSTEM CORRECTION: The requested URL redirected to a cookie/policy page. Stay in browser mode only. Do NOT call browserAction open on the same URL again right now. Instead use the visible page state, search field, categories, buttons, or product navigation already on the site to reach the original target product page. Do not use searchWeb. Do not switch to marketing/publish yet.'
        });
    }

    if (response.toolCall.name === 'browserAction' &&
        ['click', 'clickPixel', 'type', 'keyPress', 'clickText', 'hover'].includes(response.toolCall.args.action) &&
        (resultString.toLowerCase().includes('error') || resultString.toLowerCase().includes('failed') || resultString.toLowerCase().includes('not found') || resultString.includes('"transitionChanged": false'))) {

        orchestrator.onUpdate({ type: 'thought', message: `⚠️ Action failed. Initiating autonomous 'Auto-Scan' for recovery...` });
        await orchestrator.tools.browserAction({ action: 'dismissInterruptions' });
        const recoveryScan = await orchestrator.tools.browserAction({ action: 'extractActiveElements' });
        const recoveryLead = resultString.includes('"transitionChanged": false')
            ? `Original Action Did Not Cause a Visible Page Transition: ${resultString}`
            : `Original Action Failed: ${resultString}`;
        result = `${recoveryLead}\n\n[AUTO-RECOVERY SCAN DATA]:\n${recoveryScan}\n\nTip: Use the nexus-autoid-X or scan the Markdown to find the correct element for your next attempt.`;
        resultString = orchestrator._formatToolResult(result);
    }

    if (resultString.toLowerCase().includes('error') || resultString.toLowerCase().includes('missing')) {
        orchestrator.onUpdate({ type: 'thought', message: `🔍 Workflow Insight: ${resultString}` });
    }

    if (/captcha_detected|otp_required|checkpoint_detected|mfa_required/i.test(resultString)) {
        const blockerReason = orchestrator._extractBrowserBlockerReason(resultString) || 'A browser blocker requires human help.';
        orchestrator.onUpdate({
            type: 'thought',
            message: `Browser blocker detected on the current page. ${blockerReason}`
        });
        orchestrator.pendingClarification = {
            question: blockerReason,
            normalized: orchestrator._normalizeClarificationQuestion(blockerReason),
            requestedAt: new Date().toISOString()
        };
        orchestrator.onUpdate({ type: 'input_requested', message: blockerReason });
        orchestrator.isWaitingForInput = true;
        orchestrator._finishRun('paused');
        return { paused: true };
    }

    const truncatedResult = resultString.length > 5000 ? resultString.substring(0, 5000) + '...' : resultString;
    orchestrator.onUpdate({ type: 'result', message: truncatedResult });
    orchestrator.context.push({ role: 'tool', name: response.toolCall.name, content: result });

    if (response.toolCall.name === 'searchWeb' &&
        resultString.startsWith('MISSION BREACH:') &&
        orchestrator._shouldForceBrowserContinuation(orchestrator.currentTaskContract?.objective || orchestrator._getLatestUserText())) {
        orchestrator.onUpdate({
            type: 'thought',
            message: 'Browser-first mixed mission drift detected. Nexus is forcing the next step back to browser extraction.'
        });
        orchestrator.context.push({
            role: 'user',
            content: 'SYSTEM CORRECTION: searchWeb is not allowed for this browser-first mission. Use browserAction only. Recover the target product/page from the currently open site, extract the product details, and only then continue to the promotion step.'
        });
    }

    if (await orchestrator._handleToolRequirement(response.toolCall, resultString)) {
        orchestrator.isWaitingForInput = true;
        orchestrator._finishRun('paused');
        return { paused: true };
    }

    await orchestrator._applySelfHealing(response.toolCall, resultString);
    if (orchestrator.pendingRepair) {
        orchestrator.isWaitingForInput = true;
        orchestrator._finishRun('paused');
        return { paused: true };
    }

    return { paused: false, result, resultString };
}

module.exports = {
    handleAssistantText,
    executeToolTurn,
    async handleTextOnlyTurn(orchestrator, response, originalRequest) {
        const textLower = String(response.text || '').toLowerCase();

        if (textLower.includes('unexpected_tool_call')) {
            const latestUser = orchestrator._getLatestUserText();
            const likelyBanner = orchestrator._isCreativeAssetRequest(latestUser);
            const likelyOrganicMeta = orchestrator._isOrganicPublishIntent(latestUser);
            const targetUrl = orchestrator._extractFirstUrl(latestUser);
            const correction = orchestrator._shouldForceBrowserContinuation(latestUser)
                ? `ERROR: You attempted an invalid tool call during a browser mission. You MUST use browser tools only. Start with browserAction using action "open"${targetUrl ? ` and url "${targetUrl}"` : ''}. After opening, use getMarkdown or extractActiveElements to inspect the page, then continue step by step until the browser task is complete. Do not call generateImage or unrelated tools. Respond ONLY with a valid tool call from the provided tool schema.`
                : likelyOrganicMeta
                    ? `ERROR: You attempted an invalid tool call. For this request, you MUST call metaAds with action "publishOrganicPost", a concise promotional message, ${targetUrl ? `link "${targetUrl}", ` : ''}and channels ["facebook","instagram"]. Ask only for exact missing Meta credentials if needed. Respond ONLY with a valid tool call.`
                : likelyBanner
                    ? 'ERROR: You attempted an invalid tool call. For this request, you MUST call generateImage with a concrete banner prompt (Meta Ads style). Do NOT call metaAds yet. Respond ONLY with a valid tool call.'
                    : 'ERROR: You attempted an invalid tool call. Respond ONLY with a valid tool call from the provided tool schema.';
            orchestrator.onUpdate({ type: 'thought', message: '⚠️ **Detection:** Invalid tool call from LLM (UNEXPECTED_TOOL_CALL). Retrying with correction...' });
            orchestrator.context.push({ role: 'user', content: correction });
            return { needsContinue: true };
        }

        const isExplicitCompletion = orchestrator._canDeclareTaskComplete(response.text);
        const isAskingQuestion = textLower.includes('please provide') ||
            textLower.includes('i need your') ||
            textLower.includes('what you would like me to do') ||
            textLower.includes('ready for your instructions') ||
            textLower.includes('should i proceed') ||
            textLower.includes('waiting for your') ||
            textLower.includes('your confirmation');

        const isNarratingToolSuccess = orchestrator._containsNarratedToolSuccess(response.text || '');
        const isInternalBreachNotice = textLower.trimStart().startsWith('mission breach:');
        if (!isInternalBreachNotice && (orchestrator.currentMissionMode === 'execute' || orchestrator.currentMissionMode === 'chat') && isNarratingToolSuccess && !response.toolCall) {
            const latestUser = orchestrator._getLatestUserText();
            const correction = orchestrator._buildNarratedActionCorrection(latestUser);
            orchestrator.onUpdate({ type: 'thought', message: '⚠️ **Detection:** Narrated action without tool call. Injecting correction...' });
            orchestrator.context.push({ role: 'user', content: correction });
            return { needsContinue: true };
        }

        const shouldForceBrowserContinuation = orchestrator._shouldForceBrowserContinuation(originalRequest);
        const deterministicCorrection = orchestrator._buildDeterministicToolCorrection(originalRequest);

        if (shouldForceBrowserContinuation && orchestrator._isBrowserHesitationResponse(response.text || '')) {
            orchestrator.onUpdate({ type: 'thought', message: 'Browser mission hesitation detected. Nexus is forcing page-state continuation instead of stopping early.' });
            orchestrator.context.push({ role: 'user', content: 'SYSTEM CORRECTION: This is a browser mission. Do not stop because you lack inherent knowledge. Re-scan the page, read the visible UI, infer the next step, and continue autonomously. Only ask the Boss if OTP, captcha, payment approval, or truly private missing information is required.' });
            return { needsContinue: true };
        }

        if (!response.toolCall && deterministicCorrection && !orchestrator.currentMissionArtifact) {
            orchestrator.onUpdate({ type: 'thought', message: 'Deterministic execution request stalled in text-only mode. Nexus is forcing the required tool path.' });
            orchestrator.context.push({ role: 'user', content: deterministicCorrection });
            return { needsContinue: true };
        }

        if (isExplicitCompletion) {
            orchestrator.onUpdate({ type: 'complete', message: 'Task Complete. No further actions requested.' });
            orchestrator._finishRun('completed');
            return { completed: true };
        }

        if ((response.text || '').trim() && /\b(task complete|mission complete|completed|done|finished|all set|that's all)\b/i.test(textLower) && !isExplicitCompletion) {
            orchestrator.onUpdate({
                type: 'thought',
                message: 'Completion claim ignored because Nexus does not yet have enough evidence that the requested deliverable was actually produced.'
            });
            orchestrator.context.push({
                role: 'user',
                content: 'SYSTEM CORRECTION: Do not declare completion yet. The requested deliverable is not sufficiently evidenced. Continue only with steps that directly produce or verify the deliverable.'
            });
            return { needsContinue: true };
        }

        if (orchestrator.currentMissionMode === 'chat') {
            console.log('[Chat Mode] Conversational reply sent. Pausing for user input.');
            orchestrator.onUpdate({ type: 'pause' });
            orchestrator.isWaitingForInput = true;
            orchestrator._finishRun('paused');
            return { paused: true };
        }

        if (isAskingQuestion) {
            if (shouldForceBrowserContinuation && !/otp|captcha|mfa|verification code|payment|approve|approval|password/i.test(textLower)) {
                orchestrator.context.push({ role: 'user', content: 'SYSTEM CORRECTION: Do not pause this browser mission for a generic clarification. Continue with the page state, scan the page again if needed, and ask only if human-only input is truly mandatory.' });
                return { needsContinue: true };
            }
            const extractedQuestion = orchestrator._extractClarificationQuestion(response.text);
            const clarificationDecision = orchestrator._shouldAskClarification(extractedQuestion || response.text);
            if (extractedQuestion && clarificationDecision.allow) {
                orchestrator.pendingClarification = {
                    question: extractedQuestion,
                    normalized: orchestrator._normalizeClarificationQuestion(extractedQuestion),
                    requestedAt: new Date().toISOString()
                };
                orchestrator.onUpdate({ type: 'input_requested', message: extractedQuestion });
                orchestrator.isWaitingForInput = true;
                orchestrator._finishRun('paused');
                return { paused: true };
            }
            if (!clarificationDecision.allow) {
                orchestrator.context.push({
                    role: 'user',
                    content: 'SYSTEM CORRECTION: Do not repeat the same vague clarification. Continue with the available context or ask one new, specific missing-field question only if the task is truly blocked.'
                });
                return { needsContinue: true };
            }
        }

        if (orchestrator._isWeakBrowserTextTurn(response, originalRequest)) {
            orchestrator.context.push({
                role: 'user',
                content: 'SYSTEM CORRECTION: This browser mission is already in execute mode. Do not restate a plan or wait conversationally. Inspect the current browser page state and issue the next real browserAction tool call now.'
            });
            return { needsContinue: true };
        }

        if (textLower.length > 0) {
            orchestrator.onUpdate({ type: 'thought', message: response.text });
        }
        console.log('[RESILIENCE] Text-only turn detected. Continuing loop for tool execution...');
        return { needsContinue: true };
    }
};
