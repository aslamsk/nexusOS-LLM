const PLAYBOOKS = {
    GEMINI_API_KEY: {
        key: 'GEMINI_API_KEY',
        provider: 'Google AI Studio',
        title: 'Primary Gemini key',
        category: 'llm',
        url: 'https://aistudio.google.com/app/apikey',
        autoCapable: true,
        description: 'Create the primary Gemini API key used for main Nexus reasoning and execution.',
        steps: [
            'Open Google AI Studio API key page.',
            'Sign in with the target Google account.',
            'Create a new API key for the project.',
            'Copy the key into Nexus Settings or Client Keys.'
        ],
        setupPrompt: 'Open Google AI Studio, create a Gemini API key for primary inference, pause for login or MFA if needed, then continue and tell me exactly where to paste the new key in Nexus.'
    },
    GEMINI_API_KEY_2: {
        key: 'GEMINI_API_KEY_2',
        provider: 'Google AI Studio',
        title: 'Backup Gemini key',
        category: 'llm',
        url: 'https://aistudio.google.com/app/apikey',
        autoCapable: true,
        description: 'Create a backup Gemini key for failover rotation.',
        steps: [
            'Open Google AI Studio API key page.',
            'Sign in with the same or approved backup Google account.',
            'Create an additional API key.',
            'Store it as Gemini API Key 2 in Nexus.'
        ],
        setupPrompt: 'Open Google AI Studio and help me create a backup Gemini API key for failover rotation. Pause for my login or MFA input when needed, then continue and tell me where to store it in Nexus.'
    },
    BRAVE_SEARCH_API_KEY: {
        key: 'BRAVE_SEARCH_API_KEY',
        provider: 'Brave Search',
        title: 'Brave search key',
        category: 'search',
        url: 'https://api.search.brave.com/',
        autoCapable: true,
        description: 'Enable Brave as the primary live web search provider.',
        steps: [
            'Open Brave Search API dashboard.',
            'Sign in or create an account.',
            'Create an API key.',
            'Save the key in Nexus Settings or Client Keys.'
        ],
        setupPrompt: 'Open Brave Search API dashboard and guide me step by step to create a Brave Search API key. Pause for any login or payment inputs and continue after I reply.'
    },
    TAVILY_API_KEY: {
        key: 'TAVILY_API_KEY',
        provider: 'Tavily',
        title: 'Tavily fallback key',
        category: 'search',
        url: 'https://app.tavily.com/',
        autoCapable: true,
        description: 'Enable Tavily as a secondary search provider when Brave is unavailable.',
        steps: [
            'Open Tavily dashboard.',
            'Sign in or create an account.',
            'Generate an API key.',
            'Save the key in Nexus Settings or Client Keys.'
        ],
        setupPrompt: 'Open Tavily and guide me step by step to create an API key for Nexus search fallback. Pause for login or verification input and continue after I reply.'
    },
    OPENROUTER_API_TOKEN: {
        key: 'OPENROUTER_API_TOKEN',
        provider: 'OpenRouter',
        title: 'OpenRouter token',
        category: 'llm',
        url: 'https://openrouter.ai/settings/keys',
        autoCapable: true,
        description: 'Enable OpenRouter as an LLM fallback provider.',
        steps: [
            'Open OpenRouter API key settings.',
            'Sign in to the account.',
            'Create a new API key.',
            'Save the key in Nexus.'
        ],
        setupPrompt: 'Open OpenRouter account settings and guide me step by step to create an API token for Nexus fallback routing. Pause for any login or verification input and continue after I reply.'
    },
    GROQ_API_KEY: {
        key: 'GROQ_API_KEY',
        provider: 'Groq',
        title: 'Groq fallback key',
        category: 'llm',
        url: 'https://console.groq.com/keys',
        autoCapable: true,
        description: 'Enable Groq as a fast fallback LLM provider.',
        steps: [
            'Open Groq console keys page.',
            'Sign in or create an account.',
            'Create a new API key.',
            'Save the key in Nexus.'
        ],
        setupPrompt: 'Open the Groq console and guide me step by step to create a Groq API key for Nexus fallback inference. Pause for login or verification inputs and continue when I respond.'
    },
    NVIDIA_NIM_API_KEY: {
        key: 'NVIDIA_NIM_API_KEY',
        provider: 'NVIDIA NIM',
        title: 'NVIDIA fallback key',
        category: 'llm',
        url: 'https://build.nvidia.com/',
        autoCapable: true,
        description: 'Enable NVIDIA NIM as an additional fallback LLM provider.',
        steps: [
            'Open NVIDIA Build / NIM portal.',
            'Sign in and create an API key.',
            'Confirm model access if required.',
            'Save the key in Nexus.'
        ],
        setupPrompt: 'Open NVIDIA Build / NIM and guide me step by step to create an API key for Nexus fallback inference. Pause for login or verification input and continue after I reply.'
    },
    META_ACCESS_TOKEN: {
        key: 'META_ACCESS_TOKEN',
        provider: 'Meta Graph API',
        title: 'Meta access token',
        category: 'outreach',
        url: 'https://developers.facebook.com/tools/explorer/',
        autoCapable: true,
        description: 'Generate the access token required for Meta publishing and ads actions.',
        steps: [
            'Open Meta Graph API tools or Business settings.',
            'Sign in and select the correct business/page context.',
            'Generate or copy a long-lived access token.',
            'Save the token in Nexus.'
        ],
        setupPrompt: 'Open Meta Business / Graph API tools and guide me step by step to generate a Meta access token for Nexus OS. Pause for login, MFA, or page selection input and continue after I reply.'
    },
    META_AD_ACCOUNT_ID: {
        key: 'META_AD_ACCOUNT_ID',
        provider: 'Meta Ads',
        title: 'Meta ad account id',
        category: 'outreach',
        url: 'https://business.facebook.com/settings/ad-accounts',
        autoCapable: true,
        description: 'Locate the correct Meta ad account ID for paid campaign operations.',
        steps: [
            'Open Meta Business ad account settings.',
            'Select the correct business and ad account.',
            'Copy the ad account ID in act_... format.',
            'Save it in Nexus.'
        ],
        setupPrompt: 'Open Meta Business settings and help me locate the correct Meta ad account ID for this client. Pause for any login or account selection input and continue after I reply.'
    },
    GMAIL_APP_PASSWORD: {
        key: 'GMAIL_APP_PASSWORD',
        provider: 'Google Account Security',
        title: 'Gmail app password',
        category: 'outreach',
        url: 'https://myaccount.google.com/security',
        autoCapable: true,
        description: 'Generate the Gmail app password used by the Nexus email tool.',
        steps: [
            'Open Google Account security settings.',
            'Ensure 2-step verification is enabled.',
            'Open App Passwords and generate a mail app password.',
            'Save it in Nexus.'
        ],
        setupPrompt: 'Open Google Account security settings and guide me step by step to generate a Gmail app password for Nexus OS. Pause for login, 2FA, or confirmation input and continue after I reply.'
    }
};

function getPlaybook(key) {
    return PLAYBOOKS[key] ? { ...PLAYBOOKS[key] } : null;
}

function getAllPlaybooks() {
    return Object.values(PLAYBOOKS).map((item) => ({ ...item }));
}

module.exports = {
    getPlaybook,
    getAllPlaybooks
};
