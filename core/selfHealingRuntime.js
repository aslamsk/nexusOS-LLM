function recordSelfHealingEvent(recoveryHistory = [], toolCall = {}, classification = null, playbook = null) {
    const nextHistory = Array.isArray(recoveryHistory) ? [...recoveryHistory] : [];
    nextHistory.unshift({
        at: new Date().toISOString(),
        tool: toolCall.name,
        classification,
        playbook
    });
    return nextHistory.slice(0, 50);
}

function mapToolToSourceFile(toolName = '') {
    let toolFileName = `${toolName}.js`;
    if (toolName === 'browserAction') toolFileName = 'browser.js';
    if (toolName === 'readFile' || toolName === 'writeFile' || toolName === 'listDir' || toolName === 'replaceFileContent') toolFileName = 'fileSystem.js';
    return toolFileName;
}

function buildBlueprintContext(blueprints = []) {
    if (!Array.isArray(blueprints) || !blueprints.length) return '';
    return `### PROVEN FIX BLUEPRINTS FOUND:\n${blueprints.map((b, idx) => `[Blueprint ${idx + 1}]: ${b.description}\nSuggested Patch:\n${b.patch}`).join('\n\n')}\n\nINSTRUCTION: A proven fix exists for this error. Use 'replaceFileContent' to apply the most relevant blueprint above, then retry.\n`;
}

function buildRepairDiagnosticPayload({ blueprintContext = '', toolSource = '', toolFileName = '' } = {}) {
    return `[SYSTEM DIAGNOSTIC] A logic/path error occurred.\n${blueprintContext}\nSOVEREIGN ENGINEERING PROTOCOL ACTIVATED:\n1. Analyze the tool source below.\n2. If no blueprint above fits, identify the root cause and apply a new precision fix.\n3. CRITICAL: If you create a NEW fix, you MUST also use 'saveMemory' to store a 'Fix Blueprint' with a clear description so this can be used later.\n\nTOOL SOURCE [${toolFileName}]:\n${toolSource}`;
}

module.exports = {
    recordSelfHealingEvent,
    mapToolToSourceFile,
    buildBlueprintContext,
    buildRepairDiagnosticPayload
};
