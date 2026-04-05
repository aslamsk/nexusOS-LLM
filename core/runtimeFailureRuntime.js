function classifyRuntimeFailure(error = null) {
    const message = String(error?.message || error || '').trim();
    const lower = message.toLowerCase();
    if (!message) return null;

    if (/is not a function|cannot read properties|cannot set properties|undefined is not|unexpected token|referenceerror|typeerror|syntaxerror/i.test(message)) {
        return {
            type: 'runtime_logic_error',
            summary: message,
            severity: 'repairable'
        };
    }

    if (/timeout|timed out|network|econn|fetch failed/i.test(message)) {
        return {
            type: 'runtime_environment_error',
            summary: message,
            severity: 'retryable'
        };
    }

    return null;
}

function buildRuntimeRepairRequest({ classification = null, error = null, sourceFile = 'index.js' } = {}) {
    const summary = classification?.summary || String(error?.message || error || 'Unknown runtime failure');
    return {
        requestedAt: new Date().toISOString(),
        classification: classification || { type: 'runtime_logic_error', summary },
        sourceFile,
        preview: `Runtime bug detected in ${sourceFile}: ${summary}`,
        message: `Self-healing detected an internal runtime bug in ${sourceFile}.\n\nFailure: ${summary}\n\nReply YES to let Nexus enter guided self-repair mode, or NO to leave it as-is.`
    };
}

module.exports = {
    classifyRuntimeFailure,
    buildRuntimeRepairRequest
};
