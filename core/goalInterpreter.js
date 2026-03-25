const GOAL_PATTERNS = [
    { metric: 'followers', label: 'followers', regex: /\b(\d+)\s*(followers?|subs?|subscribers?)\b/i, category: 'growth' },
    { metric: 'orders', label: 'orders', regex: /\b(\d+)\s*(orders?|sales?)\b/i, category: 'revenue' },
    { metric: 'likes', label: 'likes', regex: /\b(\d+)\s*(likes?)\b/i, category: 'engagement' },
    { metric: 'reach', label: 'reach', regex: /\b(\d+)\s*(reach|reaches|people reached|views?)\b/i, category: 'awareness' },
    { metric: 'leads', label: 'leads', regex: /\b(\d+)\s*(leads?|inquiries?|enquiries?)\b/i, category: 'acquisition' },
    { metric: 'traffic', label: 'traffic', regex: /\b(\d+)\s*(clicks?|visitors?|traffic)\b/i, category: 'acquisition' },
    { metric: 'comments', label: 'comments', regex: /\b(\d+)\s*(comments?|replies?)\b/i, category: 'engagement' }
];

const CHANNEL_HINTS = [
    { channel: 'Meta', regex: /\b(meta|facebook)\b/i },
    { channel: 'Instagram', regex: /\binstagram|insta\b/i },
    { channel: 'Google Ads', regex: /\bgoogle ads|google\b/i },
    { channel: 'LinkedIn', regex: /\blinkedin\b/i },
    { channel: 'WhatsApp', regex: /\bwhatsapp\b/i },
    { channel: 'Email', regex: /\bemail|mail\b/i },
    { channel: 'Website', regex: /\bwebsite|site|landing page|product page|url\b/i }
];

function interpretGoal(text) {
    const value = String(text || '').trim();
    if (!value) return null;

    const matchedGoal = GOAL_PATTERNS.find((item) => item.regex.test(value));
    if (!matchedGoal) return null;

    const match = value.match(matchedGoal.regex);
    const targetValue = Number(match?.[1] || 0);
    if (!targetValue) return null;

    const detectedChannels = CHANNEL_HINTS
        .filter((item) => item.regex.test(value))
        .map((item) => item.channel);
    const channels = Array.from(new Set([
        ...defaultChannelsForMetric(matchedGoal.metric),
        ...detectedChannels
    ]));

    return {
        category: matchedGoal.category,
        metric: matchedGoal.metric,
        metricLabel: matchedGoal.label,
        targetValue,
        channels,
        originalRequest: value
    };
}

function defaultChannelsForMetric(metric) {
    switch (metric) {
        case 'followers':
        case 'likes':
        case 'reach':
        case 'comments':
            return ['Meta', 'Instagram'];
        case 'orders':
            return ['Website', 'Meta', 'WhatsApp'];
        case 'leads':
            return ['Meta', 'WhatsApp', 'Email'];
        case 'traffic':
            return ['Meta', 'Google Ads', 'Website'];
        default:
            return ['Meta', 'Website'];
    }
}

function buildExecutionBrief(goal) {
    if (!goal) return '';

    const outcomeLine = `BOSS GOAL DETECTED: Deliver ${goal.targetValue} ${goal.metricLabel}.`;
    const strategyMap = {
        followers: 'Plan follower growth with organic content first, then suggest paid support only if needed.',
        orders: 'Prioritize conversion strategy, offer clarity, traffic acquisition, and purchase-focused execution.',
        likes: 'Prioritize engagement hooks, thumb-stopping creative, and social posting cadence.',
        reach: 'Prioritize awareness distribution, broad-reach content, and channel-specific visibility tactics.',
        leads: 'Prioritize lead capture, offer framing, follow-up flow, and conversion handoff.',
        traffic: 'Prioritize click-worthy hooks, destination quality, and traffic-driving campaign structure.',
        comments: 'Prioritize conversation prompts, CTA framing, and community engagement tactics.'
    };

    return [
        outcomeLine,
        `Primary KPI: ${goal.metricLabel} -> ${goal.targetValue}.`,
        `Suggested channels: ${goal.channels.join(', ')}.`,
        `Execution intent: ${strategyMap[goal.metric] || 'Choose the strongest path to achieve the goal using available Nexus OS tools.'}`,
        'SYSTEM EXECUTION RULES:',
        '- Translate the Boss outcome into the right strategy automatically.',
        '- Use the available tools needed to plan, prepare, publish, contact, or analyze.',
        '- Ask only for truly missing business inputs or approval for risky actions.',
        '- If the Boss request is simple, expand it into an internal execution plan instead of asking for a better prompt.',
        '- Keep the mission outcome-focused and implementation-ready.'
    ].join('\n');
}

module.exports = {
    interpretGoal,
    buildExecutionBrief
};
