const ToolEvidenceRuntime = require('./toolEvidenceRuntime');

function hasTaskDeliverableEvidence(options = {}) {
    return ToolEvidenceRuntime.classifyDeliverableEvidence(options).hasEvidence;
}

function canDeclareTaskComplete(responseText = '', options = {}) {
    const text = String(responseText || '').toLowerCase();
    const mentionsCompletion =
        /\b(task complete|mission complete|completed|done|finished|all set|that's all)\b/i.test(text) &&
        !/\bnot (done|finished|complete)\b/i.test(text);

    if (!mentionsCompletion) return false;
    if (!hasTaskDeliverableEvidence(options)) return false;
    return true;
}

function normalizeClarificationQuestion(question = '') {
    return String(question || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function extractClarificationQuestion(responseText = '') {
    const text = String(responseText || '').trim();
    if (!text) return null;
    const candidates = text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) =>
            /\?$/.test(line) ||
            /please provide|i need your|should i proceed|waiting for your|your confirmation|tell me/i.test(line)
        );

    if (!candidates.length) return null;

    const best = candidates.find((line) => /\?$/.test(line)) || candidates[0];
    if (best.length > 220) return null;
    return best;
}

function shouldAskClarification(question = '', pendingClarification = null) {
    const normalized = normalizeClarificationQuestion(question);
    if (!normalized) return { allow: false, reason: 'empty' };

    if (pendingClarification?.normalized === normalized) {
        return { allow: false, reason: 'duplicate' };
    }

    return { allow: true, reason: 'new' };
}

module.exports = {
    hasTaskDeliverableEvidence,
    canDeclareTaskComplete,
    normalizeClarificationQuestion,
    extractClarificationQuestion,
    shouldAskClarification
};
