async function finalizeExecuteLoop(orchestrator, { isTaskCompleted = false, originalRequest = null } = {}) {
    if (!isTaskCompleted) {
        orchestrator.onUpdate({ type: 'complete', message: 'Process finished.' });
        orchestrator._finishRun(orchestrator.isWaitingForInput ? 'paused' : 'completed');
    }

    const requestToCheck = originalRequest || (orchestrator.context.find((m) => m.role === 'user')?.content || '');
    const usedBrowser = Boolean(orchestrator.currentRun?.toolsUsed?.browserAction);
    const hasExplicitClose = /auto[- ]?close(d)?/i.test(requestToCheck) || /stop browser|close browser/i.test(requestToCheck);
    const shouldClose = !orchestrator.isWaitingForInput && hasExplicitClose;

    if (shouldClose && usedBrowser) {
        orchestrator.onUpdate({ type: 'step', message: 'Auto-closing browser as requested or per mission completion protocol...' });
        await orchestrator.browserInstance.close();
        return { usedBrowser, closedBrowser: true, keptBrowserAlive: false };
    }

    if (usedBrowser && !orchestrator.isWaitingForInput) {
        orchestrator.onUpdate({ type: 'thought', message: '🌐 **Persistence Layer:** Browser session remains active for subsequent turn continuity.' });
        return { usedBrowser, closedBrowser: false, keptBrowserAlive: true };
    }

    return { usedBrowser, closedBrowser: false, keptBrowserAlive: false };
}

module.exports = {
    finalizeExecuteLoop
};
