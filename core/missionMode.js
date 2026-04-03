function normalize(text) {
    return String(text || '').toLowerCase();
}

function detectMissionMode(text, override = null) {
    const value = String(text || '').toLowerCase();
    const isCasualChat = /^(hi|hello|hey|yo|sup|thanks|thank you|good morning|good evening|good night|gm|gn|what's up|whats up|how are you|who are you|what can you do|tell me about yourself|help)\s*[!?.]*$/i.test(value.trim());

    // Any request that clearly needs tools should never fall into chat mode.
    const needsExecution =
        /\b(generate|create|design|make|build|fix|debug|publish|post|promote|send|share|delete|remove|update|deploy)\b/.test(value) &&
        /\b(image|banner|poster|creative|thumbnail|logo|video|reel|website|code|bug|quote|quotation|invoice|email|whatsapp|meta|facebook|instagram|linkedin|x|twitter|google ads?)\b/.test(value);
    const needsClarifyingPlan =
        /\b(analyze|audit|review|check|understand|look into|investigate|help me with|what is wrong|why|how to|strategy|plan)\b/.test(value) &&
        !needsExecution;
    
    // Generic browser-first routing:
    // Any request that clearly involves live page interaction should stay in EXECUTE.
    // This is intentionally page/task agnostic: routing should not depend on site-specific flows.
    const hasUrl = /https?:\/\//.test(value);
    const hasBrowserSurface = /\b(browser|website|site|page|portal|dashboard|console|url|link)\b/.test(value);
    const hasInteractiveIntent = /\b(open|visit|navigate|click|fill|type|enter|submit|select|scroll|read|check|inspect|login|log in|sign in|signin)\b/.test(value);
    const isBrowserAutomationIntent = hasUrl || (hasBrowserSurface && hasInteractiveIntent);

    if (isBrowserAutomationIntent) {
        console.log(`[MissionMode] Browser automation detected. Using EXECUTE mode.`);
        return 'execute';
    }

    if (override && ['chat', 'discuss', 'plan', 'execute'].includes(String(override).toLowerCase())) {
        const normalized = String(override).toLowerCase();
        // Never allow a "chat" override to suppress real execution when the Boss asked for work.
        if (normalized === 'chat' && (needsExecution || isBrowserAutomationIntent)) {
            console.log(`[MissionMode] Ignoring CHAT override because execution is required.`);
            return 'execute';
        }
        if (normalized === 'plan' || normalized === 'discuss') return 'plan';
        return normalized === 'chat' ? 'chat' : 'execute';
    }

    if (isCasualChat && !needsExecution) {
        console.log(`[MissionMode] Casual chat detected. Using CHAT mode.`);
        return 'chat';
    }

    if (needsClarifyingPlan) {
        console.log(`[MissionMode] Ambiguous analysis/strategy request detected. Using PLAN mode.`);
        return 'plan';
    }

    return 'execute';
}

function buildModePrompt(mode) {
    const normalized = String(mode || '').toLowerCase();
    if (normalized === 'chat') {
        return '### MISSION MODE: CHAT\nStay lightweight and conversational. Answer directly, avoid tool use unless the Boss explicitly asks to switch into execution, and keep cost low.\n\n';
    }
    if (normalized === 'plan') {
        return '### MISSION MODE: PLAN\nFirst stabilize the task. Extract the requested outcome, identify missing inputs, propose a short plan, and only then use tools that directly advance the Boss request. If the request is ambiguous, ask one precise clarification instead of improvising.\n\n';
    }
    return '### MISSION MODE: EXECUTE\nDefault to direct execution. Use the real tools when they fit the job, but still respect approval gates for risky, public, spend, or outbound actions. Preserve cross-task continuity: when the Boss jumps between domains, keep the active artifact, target, and recent task memory unless a fresh mission clearly resets it.\n\n';
}

module.exports = {
    detectMissionMode,
    buildModePrompt
};

