function buildPlanSteps(domain = 'general', request = '') {
    const normalizedDomain = String(domain || 'general').toLowerCase();
    const objective = String(request || '').trim();

    if (normalizedDomain === 'browser') {
        return [
            'Open or inspect the target page.',
            'Read the live page state and find the required fields/actions.',
            'Execute the browser steps and verify the page changed as expected.'
        ];
    }
    if (normalizedDomain === 'image') {
        return [
            'Interpret the request into a usable creative brief.',
            'Generate the image asset with the best matching prompt and format.',
            'Return the created asset as the mission result.'
        ];
    }
    if (normalizedDomain === 'video') {
        return [
            'Turn the request into a usable video brief.',
            'Generate the video asset with the available media tool.',
            'Return the output path/result once the asset exists.'
        ];
    }
    if (normalizedDomain === 'commercial') {
        return [
            'Build the quote/commercial scope from the request.',
            'Generate the quote artifacts or exact missing commercial details.',
            'Prepare the final handoff artifact for the Boss.'
        ];
    }
    if (normalizedDomain === 'outbound') {
        return [
            'Prepare the outbound message and destination details.',
            'Validate the required recipient/channel inputs.',
            'Send only after the required details are complete.'
        ];
    }
    if (normalizedDomain === 'marketing' || normalizedDomain === 'marketing_meta_organic') {
        return [
            'Prepare the content/creative needed for the marketing task.',
            'Validate the target channel and publish inputs.',
            'Execute the marketing action and capture the result.'
        ];
    }
    if (normalizedDomain === 'code') {
        return [
            'Inspect the relevant code or files.',
            'Apply the exact change needed for the requested outcome.',
            'Verify the change before declaring completion.'
        ];
    }
    return [
        'Interpret the request and identify the direct objective.',
        'Use the most relevant tool path for that objective.',
        'Verify the output before declaring completion.'
    ];
}

function detectMissingInputs(domain = 'general', request = '') {
    const value = String(request || '');
    const lower = value.toLowerCase();
    const normalizedDomain = String(domain || 'general').toLowerCase();
    const includesDomain = (name) => normalizedDomain === name || normalizedDomain.includes(name);
    const missing = [];

    if (includesDomain('browser') && /\b(login|sign in|log in)\b/.test(lower)) {
        const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value);
        const hasPassword = /\bpassword\s*[:=]/i.test(value);
        if (!hasEmail) missing.push('login username/email');
        if (!hasPassword) missing.push('login password');
    }

    if (includesDomain('outbound')) {
        if (/\bemail\b/.test(lower) && !/\bto\s*[:=]|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)) {
            missing.push('recipient email address');
        }
        if (/\bwhatsapp\b/.test(lower) && !/\b(\+?\d[\d\s-]{7,})\b/.test(value)) {
            missing.push('recipient phone number');
        }
    }

    if ((includesDomain('marketing') || includesDomain('marketing_meta_organic')) && /\bpublish|post\b/.test(lower)) {
        if (!/\bfacebook|instagram|meta|linkedin|x|twitter\b/.test(lower)) {
            missing.push('target publish channel');
        }
    }

    return missing;
}

function buildPreflightMessage(domain = 'general', request = '') {
    const steps = buildPlanSteps(domain, request);
    const heading = `Preflight plan locked for ${domain || 'general'} task:`;
    return [heading, ...steps.map((step, index) => `${index + 1}. ${step}`)].join('\n');
}

module.exports = {
    buildPlanSteps,
    detectMissingInputs,
    buildPreflightMessage
};
