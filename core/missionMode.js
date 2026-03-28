function normalize(text) {
    return String(text || '').toLowerCase();
}

function detectMissionMode(text, override = null) {
    if (override && ['chat', 'discuss', 'plan', 'execute'].includes(String(override).toLowerCase())) {
        const normalized = String(override).toLowerCase();
        return normalized === 'chat' ? 'chat' : 'execute';
    }

    normalize(text);
    return 'execute';
}

function buildModePrompt(mode) {
    if (String(mode || '').toLowerCase() === 'chat') {
        return '### MISSION MODE: CHAT\nStay lightweight and conversational. Answer directly, avoid tool use unless the Boss explicitly asks to switch into execution, and keep cost low.\n\n';
    }
    return '### MISSION MODE: EXECUTE\nDefault to direct execution. Use the real tools when they fit the job, but still respect approval gates for risky, public, spend, or outbound actions.\n\n';
}

module.exports = {
    detectMissionMode,
    buildModePrompt
};
