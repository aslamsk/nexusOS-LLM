const SetupPlaybooks = require('./setupPlaybooks');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const IDEBridge = require('./bridge');

/**
 * [STABILIZATION] Check if a binary is available on the system.
 */
function checkBinary(cmd) {
    try {
        execSync(`${cmd} --version`, { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * [STABILIZATION] Check if a path is writeable.
 */
function checkPath(p) {
    try {
        const fullPath = path.resolve(__dirname, '..', p);
        if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
        const testFile = path.join(fullPath, '.nexus_test');
        fs.writeFileSync(testFile, 'ok');
        fs.unlinkSync(testFile);
        return true;
    } catch (e) {
        return false;
    }
}

const TASK_REQUIREMENTS = [
    {
        id: 'image_gen',
        match: /\b(generate|create|design|make)\b.*\b(image|poster|banner|creative|thumbnail|logo)\b/,
        keysAny: ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3'],
        keysAll: [],
        title: 'Image generation setup incomplete',
        impact: 'Generating new images requires a working Gemini key for Imagen.'
    },
    {
        id: 'video_gen',
        match: /\b(generate|create|make)\b.*\b(video|reel|short)\b/,
        keysAny: ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'REPLICATE_API_TOKEN'],
        keysAll: [],
        title: 'Video generation setup incomplete',
        impact: 'Generative video needs a Gemini key (Veo) or Replicate token. Local FFmpeg fallback requires a source image.'
    },
    {
        id: 'meta',
        match: /\bmeta\b|\bfacebook\b|\binstagram\b/,
        keysAny: ['META_ACCESS_TOKEN'],
        keysAll: [],
        title: 'Meta setup incomplete',
        impact: 'Meta publishing and ad flows can fail or pause for missing access.'
    },
    {
        id: 'meta_ads',
        match: /\bmeta ads\b|\bfacebook ads\b|\bpaid ads\b|\bcampaign\b/,
        keysAny: [],
        keysAll: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
        title: 'Meta ads setup incomplete',
        impact: 'Paid Meta campaign setup needs both access token and ad account id.'
    },
    {
        id: 'search',
        match: /\bsearch\b|\bresearch\b|\blook up\b|\bbrowse\b|\bfind online\b/,
        keysAny: ['BRAVE_SEARCH_API_KEY', 'TAVILY_API_KEY'],
        keysAll: [],
        title: 'Search provider missing',
        impact: 'Nexus falls back to weaker or slower search behavior without Brave or Tavily.'
    },
    {
        id: 'google_ads',
        match: /\bgoogle ads\b|\bgoogle campaign\b/,
        keysAny: [],
        keysAll: ['GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_DEVELOPER_TOKEN'],
        title: 'Google Ads setup incomplete',
        impact: 'Google Ads listing and campaign actions will fail until OAuth and developer token are configured.'
    },
    {
        id: 'linkedin',
        match: /\blinkedin\b/,
        keysAny: [],
        keysAll: ['LINKEDIN_ACCESS_TOKEN'],
        title: 'LinkedIn setup incomplete',
        impact: 'LinkedIn publishing actions will fail until the LinkedIn access token is configured.'
    },
    {
        id: 'email',
        match: /\bemail\b|\bgmail\b/,
        keysAny: [],
        keysAll: ['GMAIL_USER', 'GMAIL_APP_PASSWORD'],
        title: 'Email setup incomplete',
        impact: 'Nexus cannot send or read email until Gmail credentials are configured.'
    },
    {
        id: 'whatsapp',
        match: /\bwhatsapp\b/,
        keysAny: [],
        keysAll: ['WHATSAPP_PHONE_ID', 'META_ACCESS_TOKEN'],
        title: 'WhatsApp setup incomplete',
        impact: 'WhatsApp messaging depends on both Meta token and phone id.'
    },
    {
        id: 'fallback_llm',
        match: /\bfallback\b|\bquota\b|\bbackup key\b|\bbackup model\b/,
        keysAny: ['OPENROUTER_API_TOKEN', 'GROQ_API_KEY', 'NVIDIA_NIM_API_KEY'],
        keysAll: [],
        title: 'Fallback LLM provider missing',
        impact: 'Nexus has fewer recovery options when Gemini quota or provider issues occur.'
    },
    {
        id: 'stripe',
        match: /\bstripe\b|\bpayment link\b|\bcheckout\b/,
        keysAny: [],
        keysAll: ['STRIPE_SECRET_KEY'],
        title: 'Stripe payments setup incomplete',
        impact: 'Invoices can be created without Stripe, but payment links require STRIPE_SECRET_KEY.'
    }
];

function buildAnyDiagnostic(keys, has) {
    const configuredKeys = keys.filter((key) => has(key));
    return {
        ready: configuredKeys.length > 0,
        missingKeys: configuredKeys.length ? [] : [...keys],
        configuredKeys
    };
}

function buildAllDiagnostic(keys, has) {
    const configuredKeys = keys.filter((key) => has(key));
    const missingKeys = keys.filter((key) => !has(key));
    return {
        ready: missingKeys.length === 0,
        missingKeys,
        configuredKeys
    };
}

function collectRecommendations(blockers) {
    const seen = new Set();
    const recommendations = [];
    for (const blocker of blockers) {
        const playbook = blocker.playbook;
        if (!playbook || seen.has(playbook.key)) continue;
        seen.add(playbook.key);
        recommendations.push({
            key: playbook.key,
            title: playbook.title,
            action: 'Guide Me',
            detail: `Use Nexus guided setup for ${playbook.provider}.`,
            setupPrompt: playbook.setupPrompt,
            url: playbook.url
        });
    }
    return recommendations;
}

function buildSetupDoctor({ has, firestoreReady = false, prompt = '' }) {
    const playbooks = SetupPlaybooks.getAllPlaybooks();
    const providers = playbooks.map((playbook) => {
        const diagnostic = buildAllDiagnostic([playbook.key], has);
        return {
            key: playbook.key,
            provider: playbook.provider,
            title: playbook.title,
            category: playbook.category,
            ready: diagnostic.ready,
            missingKeys: diagnostic.missingKeys,
            configuredKeys: diagnostic.configuredKeys,
            autoCapable: playbook.autoCapable,
            description: playbook.description
        };
    });

    // ─── [STABILIZATION] Architectural Health ──────────────────────────
    const architecturalHealth = {
        git: checkBinary('git'),
        rg: checkBinary('rg') || fs.existsSync(path.join(__dirname, '../node_modules/.bin/rg.exe')) || fs.existsSync(path.join(__dirname, '../node_modules/.bin/rg')),
        node: process.version,
        paths: {
            logs: checkPath('outputs/logs'),
            worktrees: checkPath('outputs/worktrees'),
            uploads: checkPath('uploads')
        },
        bridge: IDEBridge.getStatus()
    };

    const blockers = [];
    if (!firestoreReady) {
        blockers.push({
            severity: 'critical',
            code: 'firestore_unavailable',
            title: 'Firestore is not ready',
            detail: 'Client, settings, finance, and memory features depend on Firestore. Firebase credentials or Firestore setup is missing.',
            impact: 'Nexus cannot persist clients, configs, or long-term state until Firestore is fixed.',
            action: 'Guide Me',
            setupPrompt: 'Diagnose Firebase and Firestore readiness for this deployment, tell me exactly what is missing, and guide me through the fix step by step. Pause if you need my login or console confirmation.',
            playbook: null
        });
    }

    const normalizedPrompt = String(prompt || '').toLowerCase();
    for (const requirement of TASK_REQUIREMENTS) {
        if (!normalizedPrompt || !requirement.match.test(normalizedPrompt)) continue;
        const diagnostic = requirement.keysAny?.length
            ? buildAnyDiagnostic(requirement.keysAny, has)
            : buildAllDiagnostic(requirement.keysAll, has);
        if (diagnostic.ready) continue;
        const missingKey = diagnostic.missingKeys[0];
        blockers.push({
            severity: 'warning',
            code: requirement.id,
            title: requirement.title,
            detail: diagnostic.missingKeys.length
                ? `Missing: ${diagnostic.missingKeys.join(', ')}`
                : 'Required configuration is incomplete.',
            impact: requirement.impact,
            action: 'Guide Me',
            setupPrompt: missingKey ? SetupPlaybooks.getPlaybook(missingKey)?.setupPrompt : null,
            playbook: missingKey ? SetupPlaybooks.getPlaybook(missingKey) : null
        });
    }

    const summary = {
        ready: blockers.length === 0,
        status: blockers.some((item) => item.severity === 'critical') ? 'blocked' : blockers.length ? 'warning' : 'ready',
        message: blockers.length
            ? `${blockers.length} setup blocker${blockers.length > 1 ? 's' : ''} detected. Nexus should guide the Boss before the task breaks.`
            : 'Setup looks healthy. Nexus can proceed with the current task mix.'
    };

    return {
        summary,
        blockers,
        recommendations: collectRecommendations(blockers),
        providers,
        architecturalHealth
    };
}

module.exports = {
    buildSetupDoctor
};
