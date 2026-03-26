function normalize(text) {
    return String(text || '').toLowerCase();
}

function detectMissionMode(text, override = null) {
    if (override && ['discuss', 'plan', 'execute'].includes(String(override).toLowerCase())) {
        return String(override).toLowerCase();
    }

    const input = normalize(text);

    if (/\b(open|browser|website|web page|portal|login|sign in|quiz|form|submit|fill|click|type|navigate|read questions?)\b/.test(input)) {
        return 'plan';
    }

    if (/\b(start|execute|run it|do it now|publish now|launch now|send now|go live)\b/.test(input)) {
        return 'execute';
    }

    if (/\b(plan|strategy|approach|steps|prepare|audit|analyze|brief|proposal|report|ideas|brainstorm|discuss|how should we|how can we|quote|quotation|estimate|pricing|invoice|commercial)\b/.test(input)) {
        return 'plan';
    }

    return 'discuss';
}

function buildModePrompt(mode) {
    if (mode === 'execute') {
        return '### MISSION MODE: EXECUTE\nNexus is now approved to use actual execution tools and premium models where needed. Continue with real work, but still respect existing approval gates for risky/public/spend actions.\n\n';
    }
    if (mode === 'plan') {
        return '### MISSION MODE: PLAN\nKeep costs low. Prefer cheaper/free models. You may analyze, structure strategy, draft briefs, and prepare execution steps. Do not start premium media generation, public publishing, ad spend, email/WhatsApp sending, or high-cost execution until the Boss approves execution.\n\n';
    }
    return '### MISSION MODE: DISCUSS\nKeep costs as low as possible. Stay conversational, clarify goals, and shape the task. Do not start browser research, premium media generation, public publishing, ad spend, or outbound actions unless the Boss explicitly asks to move into planning or execution.\n\n';
}

module.exports = {
    detectMissionMode,
    buildModePrompt
};
