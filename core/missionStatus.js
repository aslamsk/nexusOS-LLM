function buildMissionStatusRecord(phase, detail = '', extra = {}, fallback = {}) {
    const normalizedPhase = String(phase || 'active').trim().toLowerCase() || 'active';
    const mode = String(extra.mode || fallback.mode || 'execute').trim().toLowerCase() || 'execute';
    const domain = String(extra.domain || fallback.domain || 'general').trim().toLowerCase() || 'general';
    const tool = extra.tool ? String(extra.tool).trim() : '';
    const waitingFor = extra.waitingFor ? String(extra.waitingFor).trim() : '';
    const normalizedDetail = String(detail || '').trim();
    const signature = [normalizedPhase, mode, domain, tool, waitingFor, normalizedDetail].join('|');

    const parts = [
        `phase=${normalizedPhase}`,
        `mode=${mode}`,
        `domain=${domain}`
    ];
    if (tool) parts.push(`tool=${tool}`);
    if (waitingFor) parts.push(`waiting_for=${waitingFor}`);
    if (normalizedDetail) parts.push(`detail=${normalizedDetail}`);

    return {
        signature,
        phase: normalizedPhase,
        mode,
        domain,
        tool,
        waitingFor,
        detail: normalizedDetail,
        message: `Mission Status: ${parts.join(' | ')}`
    };
}

module.exports = {
    buildMissionStatusRecord
};
