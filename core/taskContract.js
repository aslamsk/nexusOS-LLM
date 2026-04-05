function buildTaskContract(userRequest = '', deriveTaskRoutingProfile = () => ({ domain: 'general' })) {
    const value = String(userRequest || '').trim();
    const lower = value.toLowerCase();
    const deliverableHints = [];
    if (/\bquote|quotation|estimate|proposal\b/.test(lower)) deliverableHints.push('quote');
    if (/\binvoice\b/.test(lower)) deliverableHints.push('invoice');
    if (/\bemail\b/.test(lower)) deliverableHints.push('email');
    if (/\bwhatsapp\b/.test(lower)) deliverableHints.push('whatsapp message');
    if (/\bimage|banner|poster|creative|thumbnail|logo\b/.test(lower)) deliverableHints.push('image asset');
    if (/\bvideo|reel\b/.test(lower)) deliverableHints.push('video asset');
    if (/\baudit|analyze|analysis|review|check\b/.test(lower)) deliverableHints.push('analysis report');
    if (/\bfix|debug\b/.test(lower)) deliverableHints.push('verified fix');
    if (/\bcode|file|function\b/.test(lower)) deliverableHints.push('code change');

    const sideQuestGuard = [];
    if (!/\bsearch|research|browse|find online|google\b/.test(lower)) {
        sideQuestGuard.push('Do not browse or research unless the Boss asked for it.');
    }
    if (!/\bskill|sop|playbook|expert|architecture|complex|advanced\b/.test(lower)) {
        sideQuestGuard.push('Do not load specialist skills unless the task is clearly complex and relevant.');
    }
    if (!/\bpublish|post|send|share|email|whatsapp|meta|linkedin|x|twitter|google ads?\b/.test(lower)) {
        sideQuestGuard.push('Do not perform outbound, public, or paid actions unless explicitly requested.');
    }

    const routingProfile = deriveTaskRoutingProfile(lower);

    return {
        objective: value || 'Complete the current user request.',
        expectedDeliverable: deliverableHints.length ? deliverableHints.join(', ') : 'direct answer or requested output',
        successTest: 'The final output must match the user request and be supported by real tool output when tools are used.',
        sideQuestGuard,
        routingProfile
    };
}

function buildTaskContractPrompt(contract = null) {
    if (!contract) return '';
    const guardLines = contract.sideQuestGuard?.length
        ? contract.sideQuestGuard.map((item) => `- ${item}`).join('\n')
        : '- Avoid irrelevant side quests.';
    const routing = contract.routingProfile || {};
    const preferred = Array.isArray(routing.preferredTools) && routing.preferredTools.length ? routing.preferredTools.join(', ') : 'Use the most relevant tools only.';
    const blocked = Array.isArray(routing.blockedTools) && routing.blockedTools.length ? routing.blockedTools.join(', ') : 'None';
    return `### TASK CONTRACT\nRequested outcome: ${contract.objective}\nExpected deliverable: ${contract.expectedDeliverable}\nSuccess test: ${contract.successTest}\nPrimary domain: ${routing.domain || 'general'}\nPreferred tools: ${preferred}\nAvoid these tools unless the Boss clearly changes the task: ${blocked}\nSide-quest guardrails:\n${guardLines}\nIf your next step does not directly advance this contract, do not do it.\n\n`;
}

module.exports = {
    buildTaskContract,
    buildTaskContractPrompt
};
