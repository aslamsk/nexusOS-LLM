const ConfigService = require('./config');
const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');

/**
 * Nexus OS: LLM Subsystem
 * Encapsulates the interaction with the Gemini API with auto-key rotation.
 */
class LLMService {
    constructor() {
        this.modelName = 'gemini-2.5-flash';
        this.stopRequested = false;
        this.activeControllers = new Set();
        this.planOpenRouterModels = [
            'nousresearch/hermes-3-llama-3.1-405b:free',
            'arcee-ai/trinity-large-preview:free',
            'z-ai/glm-4.5-air:free'
        ];
    }

    stop() {
        this.stopRequested = true;
        for (const controller of this.activeControllers) {
            try {
                controller.abort();
            } catch (_) {}
        }
        this.activeControllers.clear();
    }

    resetStop() {
        this.stopRequested = false;
    }

    getPlanOpenRouterModels() {
        return [...this.planOpenRouterModels];
    }

    /**
     * Get an initialized Gemini client with a specific API key.
     */
    async _getClient(keyName = 'GEMINI_API_KEY') {
        const apiKey = await ConfigService.get(keyName);
        if (!apiKey) return null;
        return new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    }

    _getOpenAITools() {
        return this.getToolDefinitions().map((tool) => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }
        }));
    }

    _extractUsage(usage = {}) {
        if (!usage || typeof usage !== 'object') {
            return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
        }
        const inputTokens = Number(
            usage.prompt_tokens ??
            usage.input_tokens ??
            usage.promptTokenCount ??
            usage.inputTokenCount ??
            0
        );
        const outputTokens = Number(
            usage.completion_tokens ??
            usage.output_tokens ??
            usage.candidatesTokenCount ??
            usage.outputTokenCount ??
            0
        );
        const totalTokens = Number(
            usage.total_tokens ??
            usage.totalTokenCount ??
            (inputTokens + outputTokens)
        );
        return { inputTokens, outputTokens, totalTokens };
    }

    _formatMessagesForOpenAI(messages) {
        const formatted = [];
        let lastToolCallId = null;
        let toolCallCounter = 0;

        for (const msg of messages) {
            if (msg.role === 'system') {
                formatted.push({ role: 'system', content: msg.content });
                continue;
            }

            if (msg.role === 'assistant') {
                if (msg.toolCall) {
                    const toolCallId = `tool_call_${++toolCallCounter}`;
                    lastToolCallId = toolCallId;
                    formatted.push({
                        role: 'assistant',
                        content: msg.content || '',
                        tool_calls: [{
                            id: toolCallId,
                            type: 'function',
                            function: {
                                name: msg.toolCall.name,
                                arguments: JSON.stringify(msg.toolCall.args || {})
                            }
                        }]
                    });
                } else {
                    formatted.push({ role: 'assistant', content: msg.content || '' });
                }
                continue;
            }

            if (msg.role === 'tool') {
                formatted.push({
                    role: 'tool',
                    tool_call_id: lastToolCallId || `tool_call_${toolCallCounter || 1}`,
                    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
                });
                continue;
            }

            formatted.push({ role: 'user', content: msg.content });
        }

        return formatted;
    }

    async _generateWithOpenAICompatible({ providerName, baseUrl, apiKey, model, headers = {}, messages, mode = 'execute', enableTools = true }) {
        if (!apiKey || !model) return null;
        if (this.stopRequested) {
            return { text: 'MISSION STOPPED: Boss cancelled the mission.', toolCall: null, provider: providerName, model };
        }

        const controller = new AbortController();
        this.activeControllers.add(controller);

        let response;
        try {
            response = await axios.post(`${baseUrl}/chat/completions`, {
                model,
                messages: this._formatMessagesForOpenAI(messages),
                ...(enableTools ? {
                    tools: this.getToolDefinitions(mode).map((tool) => ({
                        type: 'function',
                        function: {
                            name: tool.name,
                            description: tool.description,
                            parameters: tool.parameters
                        }
                    })),
                    tool_choice: 'auto'
                } : {}),
                temperature: 0.2
            }, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    ...headers
                },
                signal: controller.signal
            });
        } finally {
            this.activeControllers.delete(controller);
        }

        if (this.stopRequested) {
            return { text: 'MISSION STOPPED: Boss cancelled the mission.', toolCall: null, provider: providerName, model };
        }

        const choice = response.data?.choices?.[0]?.message || {};
        const toolCall = choice.tool_calls?.[0];
        let parsedArgs = {};
        if (toolCall?.function?.arguments) {
            try {
                parsedArgs = JSON.parse(toolCall.function.arguments);
            } catch (error) {
                parsedArgs = {};
            }
        }

        return {
            text: choice.content || '',
            toolCall: toolCall ? { name: toolCall.function.name, args: parsedArgs } : null,
            provider: providerName,
            model: response.data?.model || model,
            usage: this._extractUsage(response.data?.usage || {})
        };
    }

    /**
     * Define the tools available to the LLM.
     */
    getToolDefinitions(mode = 'execute') {
        const allTools = [
            {
                name: "readFile",
                description: "Read the contents of a file.",
                parameters: {
                    type: "object",
                    properties: {
                        absolutePath: { type: "string", description: "Absolute path to the file." }
                    },
                    required: ["absolutePath"]
                }
            },
            {
                name: "writeFile",
                description: "Write content to a file. Overwrites the file if it exists.",
                parameters: {
                    type: "object",
                    properties: {
                        absolutePath: { type: "string", description: "Absolute path to the file." },
                        content: { type: "string", description: "Content to write." }
                    },
                    required: ["absolutePath", "content"]
                }
            },
            {
                name: "listDir",
                description: "List the contents of a directory.",
                parameters: {
                    type: "object",
                    properties: {
                        absolutePath: { type: "string", description: "Absolute path to the directory." }
                    },
                    required: ["absolutePath"]
                }
            },
            {
                name: "runCommand",
                description: "Execute a shell command. Use with caution.",
                parameters: {
                    type: "object",
                    properties: {
                        command: { type: "string", description: "Command to run." },
                        cwd: { type: "string", description: "Current working directory. Defaults to process cwd." }
                    },
                    required: ["command"]
                }
            },
            {
                name: "browserAction",
                description: "Perform high-precision actions using the browser sub-agent (opening links, clicking, scrolling, hovering, extracting text). Supports both CSS selectors and (x, y) coordinates.",
                parameters: {
                    type: "object",
                    properties: {
                        action: { 
                            type: "string", 
                            enum: ["open", "click", "clickPixel", "clickText", "type", "clearAndType", "focus", "keyPress", "hover", "scroll", "extract", "extractActiveElements", "getMarkdown", "screenshot", "waitForNetworkIdle", "waitForSelector"], 
                            description: "The action to perform. Use only supported browser actions. Prefer 'open' for navigation, 'waitForSelector' to confirm page state, 'clearAndType' for login fields, 'getMarkdown' for a hierarchical page view, 'extractActiveElements' for interactive items with coordinates, and 'clickPixel' only if CSS selectors fail." 
                        },
                        url: { type: "string", description: "URL to open (for 'open')." },
                        selector: { type: "string", description: "CSS selector (for 'click', 'type', 'hover', 'scroll', 'extract')." },
                        text: { type: "string", description: "Text to type (for 'type')." },
                        key: { type: "string", description: "Key to press (for 'keyPress', e.g., 'Enter')." },
                        x: { type: "number", description: "X coordinate (for 'clickPixel', 'hover')." },
                        y: { type: "number", description: "Y coordinate (for 'clickPixel', 'hover')." },
                        direction: { type: "string", enum: ["up", "down"], description: "Scroll direction (for 'scroll')." },
                        savePath: { type: "string", description: "Path to save screenshot (for 'screenshot')." },
                        timeout: { type: "number", description: "Custom timeout in ms." }
                    },
                    required: ["action"]
                }
            },
            {
                name: "searchWeb",
                description: "Search the web for live information, news, or data using the Brave Search API.",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "The search query." }
                    },
                    required: ["query"]
                }
            },
            {
                name: "codeMap",
                description: "Recursively map a codebase/directory to understand the file structure.",
                parameters: {
                    type: "object",
                    properties: {
                        absolutePath: { type: "string", description: "Root directory to map." },
                        maxDepth: { type: "number", description: "Max recursion depth. Default is 3." }
                    },
                    required: ["absolutePath"]
                }
            },
            {
                name: "codeSearch",
                description: "Search for a string or pattern across all code files in a directory.",
                parameters: {
                    type: "object",
                    properties: {
                        absolutePath: { type: "string", description: "Directory to search." },
                        query: { type: "string", description: "Search term or regex." }
                    },
                    required: ["absolutePath", "query"]
                }
            },
            {
                name: "codeFindFn",
                description: "Locate a function definition across the codebase.",
                parameters: {
                    type: "object",
                    properties: {
                        absolutePath: { type: "string", description: "Directory to search." },
                        functionName: { type: "string", description: "Name of the function to find." }
                    },
                    required: ["absolutePath", "functionName"]
                }
            },
            {
                name: "generateImage",
                description: "Generate a new image from a text prompt (premium quality).",
                parameters: {
                    type: "object",
                    properties: {
                        prompt: { type: "string", description: "Description of the image." },
                        savePath: { type: "string", description: "Absolute path to save the .png file." }
                    },
                    required: ["prompt", "savePath"]
                }
            },
            {
                name: "generateVideo",
                description: "Generate a video from a text prompt or animate an existing image.",
                parameters: {
                    type: "object",
                    properties: {
                        prompt: { type: "string", description: "Text description of the video." },
                        imagePath: { type: "string", description: "Path to source image to animate." },
                        outputPath: { type: "string", description: "Path for output .mp4." }
                    },
                    required: ["outputPath"]
                }
            },
            {
                name: "removeBg",
                description: "Remove the background from an image.",
                parameters: {
                    type: "object",
                    properties: {
                        inputPath: { type: "string", description: "Path to source image." },
                        outputPath: { type: "string", description: "Path for output .png." }
                    },
                    required: ["inputPath", "outputPath"]
                }
            },
            {
                name: "metaAds",
                description: "Unified Meta Ads tool for campaigns, creatives, and organic posts.",
                parameters: {
                    type: "object",
                    properties: {
                        action: { type: "string", enum: ["createCampaign", "createAdSet", "createAdCreative", "createAd", "publishOrganicPost", "publishOrganicPhoto", "publishOrganicVideo", "publishOrganicReel", "getPageInsights", "getAccountInfo", "uploadImage", "metaGetComments", "metaSetCredentials", "metaReplyToComment"], description: "Action to perform." },
                        pageId: { type: "string" },
                        message: { type: "string" },
                        link: { type: "string" },
                        videoPath: { type: "string" },
                        imagePath: { type: "string" },
                        name: { type: "string" },
                        objective: { type: "string" },
                        campaignId: { type: "string" },
                        budget: { type: "number" },
                        targeting: { type: "object" },
                        title: { type: "string" },
                        body: { type: "string" },
                        imageHash: { type: "string" },
                        imageUrl: { type: "string" },
                        cta: { type: "string" },
                        adSetId: { type: "string" },
                        creativeId: { type: "string" },
                        boss_approved: { type: "boolean", description: "Mandatory for publishing. Set to true if approval was received." }
                    },
                    required: ["action"]
                }
            },
            {
                name: "googleAdsCreateBudget",
                description: "Create a Google Ads campaign budget resource.",
                parameters: {
                    type: "object",
                    properties: {
                        customerId: { type: "string" },
                        name: { type: "string" },
                        amountMicros: { type: "number", description: "Budget amount in micros." },
                        deliveryMethod: { type: "string" }
                    },
                    required: ["customerId", "name", "amountMicros"]
                }
            },
            {
                name: "googleAdsCreateCampaign",
                description: "Create a paused Google Ads campaign using an existing budget resource.",
                parameters: {
                    type: "object",
                    properties: {
                        customerId: { type: "string" },
                        campaignData: { type: "object" }
                    },
                    required: ["customerId", "campaignData"]
                }
            },
            {
                name: "googleAdsCreateAdGroup",
                description: "Create a Google Ads ad group inside a campaign.",
                parameters: {
                    type: "object",
                    properties: {
                        customerId: { type: "string" },
                        adGroupData: { type: "object" }
                    },
                    required: ["customerId", "adGroupData"]
                }
            },
            {
                name: "googleAdsAddKeywords",
                description: "Add keywords to a Google Ads ad group.",
                parameters: {
                    type: "object",
                    properties: {
                        customerId: { type: "string" },
                        adGroupResourceName: { type: "string" },
                        keywords: { type: "array", items: { type: "string" } }
                    },
                    required: ["customerId", "adGroupResourceName", "keywords"]
                }
            },
            {
                name: "googleAdsCreateResponsiveSearchAd",
                description: "Create a paused responsive search ad in Google Ads.",
                parameters: {
                    type: "object",
                    properties: {
                        customerId: { type: "string" },
                        adData: { type: "object" }
                    },
                    required: ["customerId", "adData"]
                }
            },
            {
                name: "linkedinPublishPost",
                description: "Publish an organic post to a LinkedIn organization page.",
                parameters: {
                    type: "object",
                    properties: {
                        urn: { type: "string", description: "LinkedIn organization URN." },
                        text: { type: "string", description: "Post text." }
                    },
                    required: ["urn", "text"]
                }
            },
            {
                name: "replaceFileContent",
                description: "Surgically replace lines in a file by providing exact target content.",
                parameters: {
                    type: "object",
                    properties: {
                        absolutePath: { type: "string" },
                        startLine: { type: "number" },
                        endLine: { type: "number" },
                        targetContent: { type: "string" },
                        replacementContent: { type: "string" }
                    },
                    required: ["absolutePath", "startLine", "endLine", "targetContent", "replacementContent"]
                }
            },
            {
                name: "multiReplaceFileContent",
                description: "Perform multiple surgical replacements in one file.",
                parameters: {
                    type: "object",
                    properties: {
                        absolutePath: { type: "string" },
                        chunks: { type: "array", items: { type: "object" } }
                    },
                    required: ["absolutePath", "chunks"]
                }
            },
            {
                name: "sendEmail",
                description: "Send an email via Gmail.",
                parameters: {
                    type: "object",
                    properties: {
                        to: { type: "string" },
                        subject: { type: "string" },
                        body: { type: "string" }
                    },
                    required: ["to", "subject", "body"]
                }
            },
            {
                name: "readEmail",
                description: "Read the latest emails from Gmail.",
                parameters: {
                    type: "object",
                    properties: {
                        limit: { type: "number" }
                    }
                }
            },
            {
                name: "sendWhatsApp",
                description: "Send a WhatsApp text message.",
                parameters: {
                    type: "object",
                    properties: {
                        phone: { type: "string" },
                        text: { type: "string" }
                    },
                    required: ["phone", "text"]
                }
            },
            {
                name: "sendWhatsAppMedia",
                description: "Send an image or video via WhatsApp.",
                parameters: {
                    type: "object",
                    properties: {
                        phone: { type: "string" },
                        mediaUrl: { type: "string" },
                        caption: { type: "string" }
                    },
                    required: ["phone", "mediaUrl"]
                }
            },
            {
                name: "analyzeMarketingPage",
                description: "Analyze a marketing page URL.",
                parameters: {
                    type: "object",
                    properties: {
                        target: { type: "string", description: "URL or topic to analyze." },
                        channels: { type: "array", items: { type: "string" }, description: "Marketing channels." }
                    },
                    required: ["target"]
                }
            },
            {
                name: "scanCompetitors",
                description: "Build a structured competitor scan.",
                parameters: {
                    type: "object",
                    properties: {
                        target: { type: "string" },
                        competitors: { type: "array", items: { type: "string" } },
                        notes: { type: "string" }
                    },
                    required: ["target"]
                }
            },
            {
                name: "generateSocialCalendar",
                description: "Generate a multi-week social calendar.",
                parameters: {
                    type: "object",
                    properties: {
                        target: { type: "string" },
                        channels: { type: "array", items: { type: "string" } },
                        weeks: { type: "number" },
                        theme: { type: "string" },
                        notes: { type: "string" }
                    },
                    required: ["target"]
                }
            },
            {
                name: "buildAgencyQuotePlan",
                description: "Build a commercial agency quote plan.",
                parameters: {
                    type: "object",
                    properties: {
                        campaignName: { type: "string" },
                        bannerCount: { type: "number" },
                        carouselCount: { type: "number" },
                        videoCount: { type: "number" },
                        contentDeliverables: { type: "number" },
                        tagPackages: { type: "number" },
                        reportCount: { type: "number" },
                        auditCount: { type: "number" },
                        metaAdsWeeks: { type: "number" },
                        googleAdsWeeks: { type: "number" },
                        linkedinAdsWeeks: { type: "number" },
                        websiteProject: { type: "boolean" },
                        websitePages: { type: "number" },
                        adSpendMonthly: { type: "number" },
                        profitMarginPct: { type: "number" },
                        taxPct: { type: "number" },
                        currency: { type: "string" },
                        includeStrategyRetainer: { type: "boolean" },
                        notes: { type: "string" }
                    }
                }
            },
            {
                name: "createAgencyQuoteArtifacts",
                description: "Generate client-ready commercial quote artifacts.",
                parameters: {
                    type: "object",
                    properties: {
                        campaignName: { type: "string" },
                        clientName: { type: "string" },
                        clientCompany: { type: "string" },
                        clientEmail: { type: "string" }
                    }
                }
            },
            {
                name: "saveMemory",
                description: "Store a fact permanently.",
                parameters: {
                    type: "object",
                    properties: {
                        content: { type: "string" },
                        category: { type: "string" }
                    },
                    required: ["content"]
                }
            },
            {
                name: "searchMemory",
                description: "Recall past information.",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "delegateToAgent",
                description: "Delegate to a specialist agent.",
                parameters: {
                    type: "object",
                    properties: {
                        agentType: { type: "string", enum: ["researcher", "writer", "coder", "designer", "ads_manager"] },
                        task: { type: "string" }
                    },
                    required: ["agentType", "task"]
                }
            },
            {
                name: "createSkill",
                description: "Create a new autonomous JS skill.",
                parameters: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        code: { type: "string" },
                        description: { type: "string" }
                    },
                    required: ["name", "code", "description"]
                }
            },
            {
                name: "executeSkill",
                description: "Execute an autonomously created skill.",
                parameters: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        params: { type: "object" }
                    },
                    required: ["name"]
                }
            },
            {
                name: "scanNiche",
                description: "Proactively scan a niche.",
                parameters: {
                    type: "object",
                    properties: {
                        niche: { type: "string" }
                    },
                    required: ["niche"]
                }
            },
            {
                name: "proposeCampaign",
                description: "Generate a campaign proposal.",
                parameters: {
                    type: "object",
                    properties: {
                        opportunityId: { type: "string" }
                    },
                    required: ["opportunityId"]
                }
            },
            {
                name: "listSkills",
                description: "List all autonomous skills.",
                parameters: { type: "object", properties: {} }
            },
            {
                name: "askUserForInput",
                description: "Ask the user a question.",
                parameters: {
                    type: "object",
                    properties: {
                        question: { type: "string" }
                    },
                    required: ["question"]
                }
            }
        ];


        const toolNamesByMode = {
            discuss: [
                'searchWeb',
                'codeMap',
                'codeSearch',
                'codeFindFn',
                'saveMemory',
                'searchMemory',
                'analyzeMarketingPage',
                'scanCompetitors',
                'generateSocialCalendar',
                'buildAgencyQuotePlan',
                'createAgencyQuoteArtifacts',
                'createSkill',
                'executeSkill',
                'listSkills',
                'scanNiche',
                'proposeCampaign',
                'askUserForInput'
            ],
            plan: allTools.map((tool) => tool.name),
            execute: allTools.map((tool) => tool.name)
        };

        const allowed = new Set(toolNamesByMode[mode] || toolNamesByMode.execute);
        return allTools.filter((tool) => allowed.has(tool.name));
    }

    /**
     * Send conversation history to the LLM and get the next response.
     */
    async generateResponse(messages, options = {}) {
        try {
            this.resetStop();
            const mode = String(options.mode || 'execute').toLowerCase();
            const enableTools = options.enableTools !== false && mode !== 'chat';
            let formattedContents = messages.map(msg => {
                if (msg.role === 'system') {
                    return { role: 'user', parts: [{ text: `SYSTEM INSTRUCTION: ${msg.content}` }] };
                } else if (msg.role === 'assistant') {
                    const parts = [];
                    if (msg.content) parts.push({ text: msg.content });
                    if (msg.toolCall) {
                        parts.push({
                            functionCall: {
                                name: msg.toolCall.name,
                                args: msg.toolCall.args
                            }
                        });
                    }
                    return { role: 'model', parts: parts };
                } else if (msg.role === 'tool') {
                    return {
                        role: 'user',
                        parts: [{
                            functionResponse: {
                                name: msg.name,
                                response: { result: msg.content }
                            }
                        }]
                    };
                } else {
                    return { role: 'user', parts: [{ text: msg.content }] };
                }
            });

            // CRITICAL BUG FIX: Guard against "contents are required" Google SDK error
            // If empty, inject a default hello to keep the session alive
            if (formattedContents.length === 0) {
                formattedContents = [{ role: 'user', parts: [{ text: 'Hello Nexus.' }] }];
            }

            let systemInstruction = null;
            if (messages[0] && messages[0].role === 'system') {
                systemInstruction = { parts: [{ text: messages[0].content }] };
                // Only shift if we have more than one message to avoid leaving formattedContents empty
                if (formattedContents.length > 1) {
                    formattedContents.shift();
                }
            }

            const openRouterApiKey = await ConfigService.get('OPENROUTER_API_TOKEN');
            const configuredOpenRouterModel = await ConfigService.get('OPENROUTER_MODEL') || 'openrouter/free';
            const openRouterHeaders = {
                'HTTP-Referer': 'https://nexus-os.local',
                'X-Title': 'Nexus OS'
            };

            const fallbackProviders = [
                {
                    name: 'Groq',
                    baseUrl: 'https://api.groq.com/openai/v1',
                    apiKey: await ConfigService.get('GROQ_API_KEY'),
                    model: await ConfigService.get('GROQ_MODEL') || 'llama-3.1-8b-instant'
                },
                {
                    name: 'NVIDIA',
                    baseUrl: 'https://integrate.api.nvidia.com/v1',
                    apiKey: await ConfigService.get('NVIDIA_NIM_API_KEY'),
                    model: await ConfigService.get('NVIDIA_MODEL') || 'meta/llama-3.1-8b-instruct'
                }
            ];

            const geminiProvider = {
                name: 'Gemini',
                baseUrl: null,
                apiKey: null,
                model: this.modelName
            };

            const openRouterPrimary = {
                name: 'OpenRouter',
                baseUrl: 'https://openrouter.ai/api/v1',
                apiKey: openRouterApiKey,
                model: configuredOpenRouterModel,
                headers: openRouterHeaders
            };

            // UPGRADE: Gemini is now the primary driver for ALL modes to ensure "WOW" performance and stability
            const orderedProviders = [
                geminiProvider,
                openRouterPrimary,
                ...fallbackProviders
            ];

            for (const provider of orderedProviders) {
                if (provider.name === 'Gemini') break;
                if (!provider.apiKey) continue;

                const candidateModels = Array.isArray(provider.modelCandidates) && provider.modelCandidates.length
                    ? provider.modelCandidates
                    : [provider.model];

                for (const candidateModel of candidateModels) {
                    try {
                        console.log(`[LLM] Falling back to ${provider.name} using model ${candidateModel}...`);
                        const fallbackResponse = await this._generateWithOpenAICompatible({
                            providerName: provider.name,
                            baseUrl: provider.baseUrl,
                            apiKey: provider.apiKey,
                            model: candidateModel,
                            headers: provider.headers,
                            messages,
                            mode,
                            enableTools
                        });
                        if (fallbackResponse) return fallbackResponse;
                    } catch (error) {
                        if (axios.isCancel?.(error) || error.code === 'ERR_CANCELED') {
                            return { text: 'MISSION STOPPED: Boss cancelled the mission.', toolCall: null, provider: provider.name, model: candidateModel };
                        }
                        console.error(`[LLM ${provider.name} Fallback Error]`, error.response?.data || error.message);
                    }
                }
            }

            const keys = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3'];
            let currentKeyIdx = 0;
            let retryCount = 0;
            const maxRetriesPerKey = 3;
            let delay = 2000;

            while (currentKeyIdx < keys.length) {
                const keyName = keys[currentKeyIdx];
                const ai = await this._getClient(keyName);
                
                if (!ai) {
                    currentKeyIdx++;
                    continue;
                }

                try {
                    const response = await ai.models.generateContent({
                        model: this.modelName,
                        systemInstruction: systemInstruction,
                        contents: formattedContents,
                        config: {
                            ...(enableTools ? { tools: [{ functionDeclarations: this.getToolDefinitions(mode) }] } : {}),
                            generationConfig: { temperature: 0.2 }
                        }
                    });

                    if (this.stopRequested) {
                        return { text: 'MISSION STOPPED: Boss cancelled the mission.', toolCall: null, provider: 'Gemini', model: this.modelName };
                    }

                    const functionCall = response.functionCalls?.[0];
                    let textContent = '';
                    try {
                        if (response.candidates?.[0]?.content?.parts?.some(p => p.text)) {
                            textContent = response.text;
                        }
                    } catch (e) {
                        textContent = '';
                    }

                    return {
                        text: textContent,
                        toolCall: functionCall ? { name: functionCall.name, args: functionCall.args } : null,
                        provider: 'Gemini',
                        model: this.modelName,
                        usage: this._extractUsage(response.usageMetadata || response.usage || {})
                    };
                } catch (error) {
                    if (this.stopRequested) {
                        return { text: 'MISSION STOPPED: Boss cancelled the mission.', toolCall: null, provider: 'Gemini', model: this.modelName };
                    }
                    const isRetryable = error.message.includes('429') ||
                        error.message.includes('503') ||
                        error.message.includes('UNAVAILABLE') ||
                        error.message.includes('INTERNAL');

                    if (isRetryable) {
                        const errorType = error.message.includes('429') ? '429 Rate Limit' : '503/UNAVAILABLE';
                        console.log(`[LLM] ${errorType} on ${keyName}.`);
                        if (retryCount < maxRetriesPerKey) {
                            console.log(`[LLM] Retrying ${keyName} in ${delay / 1000}s... (Attempt ${retryCount + 1}/${maxRetriesPerKey})`);
                            await new Promise(r => setTimeout(r, delay));
                            retryCount++;
                            delay *= 2;
                            continue;
                        }
                        console.log(`[LLM] Rotating to backup Gemini API key...`);
                        currentKeyIdx++;
                        retryCount = 0;
                        delay = 2000;
                        continue;
                    }
                    console.error("[LLM API Error]", error.message);
                    return { text: `Error calling LLM: ${error.message}`, toolCall: null };
                }
            }

            const quotaMsg = "Nexus OS has exhausted Gemini and no configured fallback provider succeeded. Add a fresh Gemini key or configure OpenRouter, Groq, or NVIDIA fallback settings.";
            console.error(`[LLM Max Retries] ${quotaMsg}`);
            return { text: `MISSION BREACH: API Quota Exhausted. ${quotaMsg}`, toolCall: null };

        } catch (error) {
            console.error("[LLM Error]", error);
            return { text: `Error calling LLM: ${error.message}`, toolCall: null };
        }
    }
}

module.exports = LLMService;
