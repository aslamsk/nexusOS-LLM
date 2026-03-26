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
            'openai/gpt-oss-20b:free',
            'openai/gpt-oss-120b:free',
            'google/gemma-3-27b-it:free',
            'google/gemma-3-12b-it:free'
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

    async _generateWithOpenAICompatible({ providerName, baseUrl, apiKey, model, headers = {}, messages, mode = 'execute' }) {
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
                tools: this.getToolDefinitions(mode).map((tool) => ({
                    type: 'function',
                    function: {
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.parameters
                    }
                })),
                tool_choice: 'auto',
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
            model: response.data?.model || model
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
                    type: "OBJECT",
                    properties: {
                        absolutePath: { type: "STRING", description: "Absolute path to the file." }
                    },
                    required: ["absolutePath"]
                }
            },
            {
                name: "writeFile",
                description: "Write content to a file. Overwrites the file if it exists.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        absolutePath: { type: "STRING", description: "Absolute path to the file." },
                        content: { type: "STRING", description: "Content to write." }
                    },
                    required: ["absolutePath", "content"]
                }
            },
            {
                name: "listDir",
                description: "List the contents of a directory.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        absolutePath: { type: "STRING", description: "Absolute path to the directory." }
                    },
                    required: ["absolutePath"]
                }
            },
            {
                name: "runCommand",
                description: "Execute a shell command. Use with caution.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        command: { type: "STRING", description: "Command to run." },
                        cwd: { type: "STRING", description: "Current working directory. Defaults to process cwd." }
                    },
                    required: ["command"]
                }
            },
            {
                name: "browserAction",
                description: "Perform high-precision actions using the browser sub-agent (opening links, clicking, scrolling, hovering, extracting text). Supports both CSS selectors and (x, y) coordinates.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { 
                            type: "STRING", 
                            enum: ["open", "click", "clickPixel", "clickText", "type", "clearAndType", "focus", "keyPress", "hover", "scroll", "extract", "extractActiveElements", "getMarkdown", "screenshot", "waitForNetworkIdle", "waitForSelector"], 
                            description: "The action to perform. Use only supported browser actions. Prefer 'open' for navigation, 'waitForSelector' to confirm page state, 'clearAndType' for login fields, 'getMarkdown' for a hierarchical page view, 'extractActiveElements' for interactive items with coordinates, and 'clickPixel' only if CSS selectors fail." 
                        },
                        url: { type: "STRING", description: "URL to open (for 'open')." },
                        selector: { type: "STRING", description: "CSS selector (for 'click', 'type', 'hover', 'scroll', 'extract')." },
                        text: { type: "STRING", description: "Text to type (for 'type')." },
                        key: { type: "STRING", description: "Key to press (for 'keyPress', e.g., 'Enter')." },
                        x: { type: "NUMBER", description: "X coordinate (for 'clickPixel', 'hover')." },
                        y: { type: "NUMBER", description: "Y coordinate (for 'clickPixel', 'hover')." },
                        direction: { type: "STRING", enum: ["up", "down"], description: "Scroll direction (for 'scroll')." },
                        savePath: { type: "STRING", description: "Path to save screenshot (for 'screenshot')." },
                        timeout: { type: "NUMBER", description: "Custom timeout in ms." }
                    },
                    required: ["action"]
                }
            },
            {
                name: "searchWeb",
                description: "Search the web for live information, news, or data using the Brave Search API.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "The search query." }
                    },
                    required: ["query"]
                }
            },
            {
                name: "codeMap",
                description: "Recursively map a codebase/directory to understand the file structure.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        absolutePath: { type: "STRING", description: "Root directory to map." },
                        maxDepth: { type: "NUMBER", description: "Max recursion depth. Default is 3." }
                    },
                    required: ["absolutePath"]
                }
            },
            {
                name: "codeSearch",
                description: "Search for a string or pattern across all code files in a directory.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        absolutePath: { type: "STRING", description: "Directory to search." },
                        query: { type: "STRING", description: "Search term or regex." }
                    },
                    required: ["absolutePath", "query"]
                }
            },
            {
                name: "codeFindFn",
                description: "Locate a function definition across the codebase.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        absolutePath: { type: "STRING", description: "Directory to search." },
                        functionName: { type: "STRING", description: "Name of the function to find." }
                    },
                    required: ["absolutePath", "functionName"]
                }
            },
            {
                name: "generate_image",
                description: "Generate a new image from a text prompt (premium quality).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        prompt: { type: "STRING", description: "Description of the image." },
                        savePath: { type: "STRING", description: "Absolute path to save the .png file." }
                    },
                    required: ["prompt", "savePath"]
                }
            },
            {
                name: "improveImage",
                description: "Enhance or modify an existing image based on a prompt.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        prompt: { type: "STRING", description: "Description of enhancements." },
                        imagePath: { type: "STRING", description: "Path to original image." },
                        savePath: { type: "STRING", description: "Path to save improved image." }
                    },
                    required: ["prompt", "imagePath", "savePath"]
                }
            },
            {
                name: "n8nSearch",
                description: "Search for available n8n workflows.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Search query." }
                    },
                    required: ["query"]
                }
            },
            {
                name: "getN8nWorkflow",
                description: "Get details and execute an n8n workflow.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        path: { type: "STRING", description: "Path to workflow." }
                    },
                    required: ["path"]
                }
            },
            {
                name: "metaGetComments",
                description: "Fetch comments from a specific Meta post or entity.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        objectId: { type: "STRING", description: "The ID of the post/object." }
                    },
                    required: ["objectId"]
                }
            },
            {
                name: "metaReplyToComment",
                description: "Reply publicly to a specific comment on Meta.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        commentId: { type: "STRING", description: "The ID of the comment to reply to." },
                        message: { type: "STRING", description: "The reply message." }
                    },
                    required: ["commentId", "message"]
                }
            },
            {
                name: "metaSetCredentials",
                description: "Configure Meta API credentials dynamically.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        accessToken: { type: "STRING" },
                        adAccountId: { type: "STRING" },
                        pageId: { type: "STRING" }
                    },
                    required: ["accessToken", "adAccountId", "pageId"]
                }
            },
            {
                name: "generateVideo",
                description: "Generate a video from a text prompt or animate an existing image.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        prompt: { type: "STRING", description: "Text description of the video." },
                        imagePath: { type: "STRING", description: "Path to source image to animate." },
                        outputPath: { type: "STRING", description: "Path for output .mp4." }
                    },
                    required: ["outputPath"]
                }
            },
            {
                name: "removeBg",
                description: "Remove the background from an image.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        inputPath: { type: "STRING", description: "Path to source image." },
                        outputPath: { type: "STRING", description: "Path for output .png." }
                    },
                    required: ["inputPath", "outputPath"]
                }
            },
            {
                name: "metaAds",
                description: "Unified Meta Ads tool for campaigns, creatives, and organic posts.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", description: "Action to perform: 'publishOrganicPost', 'publishOrganicReel', 'createCampaign', 'createAdSet', 'createAdCreative', 'createAd', 'getPageInsights', 'uploadImage', 'getAccountInfo'" },
                        pageId: { type: "STRING" },
                        message: { type: "STRING" },
                        link: { type: "STRING" },
                        videoPath: { type: "STRING" },
                        imagePath: { type: "STRING" },
                        name: { type: "STRING" },
                        objective: { type: "STRING" },
                        campaignId: { type: "STRING" },
                        budget: { type: "NUMBER" },
                        targeting: { type: "OBJECT" },
                        title: { type: "STRING" },
                        body: { type: "STRING" },
                        cta: { type: "STRING" },
                        adSetId: { type: "STRING" },
                        creativeId: { type: "STRING" },
                        boss_approved: { type: "BOOLEAN", description: "MANDATORY FOR PUBLISHING/SPENDING ACTIONS. If you are creating a campaign, ad, or publishing a post, you MUST first ask The Boss for approval. If you have NOT explicitly asked for and received permission for this specific payload, this must be false (or omitted) and the system will block you. If The Boss has already approved the preview, set this to true." }
                    },
                    required: ["action"]
                }
            },
            {
                name: "replaceFileContent",
                description: "Surgically replace lines in a file by providing exact target content.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        absolutePath: { type: "STRING" },
                        startLine: { type: "NUMBER" },
                        endLine: { type: "NUMBER" },
                        targetContent: { type: "STRING" },
                        replacementContent: { type: "STRING" }
                    },
                    required: ["absolutePath", "startLine", "endLine", "targetContent", "replacementContent"]
                }
            },
            {
                name: "multiReplaceFileContent",
                description: "Perform multiple surgical replacements in one file.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        absolutePath: { type: "STRING" },
                        chunks: { type: "ARRAY", items: { type: "OBJECT" } }
                    },
                    required: ["absolutePath", "chunks"]
                }
            },
            {
                name: "sendEmail",
                description: "Send an email to a client or team member via Gmail.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        to: { type: "STRING", description: "Recipient email address." },
                        subject: { type: "STRING", description: "Email subject." },
                        body: { type: "STRING", description: "Email body text." }
                    },
                    required: ["to", "subject", "body"]
                }
            },
            {
                name: "readEmail",
                description: "Read the latest emails from the Gmail inbox.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        limit: { type: "NUMBER", description: "Number of emails to read. Default is 5." }
                    }
                }
            },
            {
                name: "sendWhatsApp",
                description: "Send a WhatsApp text message to a phone number.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        phone: { type: "STRING", description: "Phone number with country code (e.g. 918885202721)." },
                        text: { type: "STRING", description: "Message content." }
                    },
                    required: ["phone", "text"]
                }
            },
            {
                name: "sendWhatsAppMedia",
                description: "Send an image or video via WhatsApp.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        phone: { type: "STRING", description: "Phone number with country code." },
                        mediaUrl: { type: "STRING", description: "Publicly accessible URL of the media." },
                        caption: { type: "STRING", description: "Optional caption for the media." }
                    },
                    required: ["phone", "mediaUrl"]
                }
            },
            {
                name: "analyzeMarketingPage",
                description: "Generate a structured marketing page analysis from a target URL/topic, notes, and channels.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        target: { type: "STRING", description: "Website URL, landing page URL, or target topic." },
                        notes: { type: "STRING", description: "Extra context, goals, or constraints." },
                        channels: { type: "ARRAY", items: { type: "STRING" }, description: "Relevant channels like Meta Ads, Google Ads, Email, LinkedIn." }
                    },
                    required: ["target"]
                }
            },
            {
                name: "scanCompetitors",
                description: "Build a structured competitor scan using supplied competitor names or domains.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        target: { type: "STRING", description: "Primary brand, domain, or offer being compared." },
                        competitors: { type: "ARRAY", items: { type: "STRING" }, description: "Competitor names or domains." },
                        notes: { type: "STRING", description: "Extra comparison notes or market framing." }
                    },
                    required: ["target"]
                }
            },
            {
                name: "generateSocialCalendar",
                description: "Generate a structured multi-week social calendar for a campaign, brand, or offer.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        target: { type: "STRING", description: "Brand, offer, campaign, or target topic." },
                        channels: { type: "ARRAY", items: { type: "STRING" }, description: "Channels to plan for." },
                        weeks: { type: "NUMBER", description: "Number of weeks. Defaults to 4." },
                        theme: { type: "STRING", description: "Campaign theme or launch theme." },
                        notes: { type: "STRING", description: "Constraints, goals, or audience notes." }
                    },
                    required: ["target"]
                }
            },
            {
                name: "buildAgencyQuotePlan",
                description: "Build a commercial agency quote plan for recurring creative and ads work, including AI/model cost estimates after free-tier usage.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        campaignName: { type: "STRING" },
                        bannerCount: { type: "NUMBER" },
                        carouselCount: { type: "NUMBER" },
                        videoCount: { type: "NUMBER" },
                        contentDeliverables: { type: "NUMBER" },
                        tagPackages: { type: "NUMBER" },
                        reportCount: { type: "NUMBER" },
                        auditCount: { type: "NUMBER" },
                        metaAdsWeeks: { type: "NUMBER" },
                        googleAdsWeeks: { type: "NUMBER" },
                        linkedinAdsWeeks: { type: "NUMBER" },
                        websiteProject: { type: "BOOLEAN" },
                        websitePages: { type: "NUMBER" },
                        adSpendMonthly: { type: "NUMBER" },
                        profitMarginPct: { type: "NUMBER" },
                        taxPct: { type: "NUMBER" },
                        currency: { type: "STRING" },
                        includeStrategyRetainer: { type: "BOOLEAN" },
                        notes: { type: "STRING" }
                    }
                }
            },
            {
                name: "createAgencyQuoteArtifacts",
                description: "Generate client-ready commercial quote artifacts (PDF, CSV, Markdown) for an agency plan inside the current task output folder.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        campaignName: { type: "STRING" },
                        bannerCount: { type: "NUMBER" },
                        carouselCount: { type: "NUMBER" },
                        videoCount: { type: "NUMBER" },
                        contentDeliverables: { type: "NUMBER" },
                        tagPackages: { type: "NUMBER" },
                        reportCount: { type: "NUMBER" },
                        auditCount: { type: "NUMBER" },
                        metaAdsWeeks: { type: "NUMBER" },
                        googleAdsWeeks: { type: "NUMBER" },
                        linkedinAdsWeeks: { type: "NUMBER" },
                        websiteProject: { type: "BOOLEAN" },
                        websitePages: { type: "NUMBER" },
                        adSpendMonthly: { type: "NUMBER" },
                        profitMarginPct: { type: "NUMBER" },
                        taxPct: { type: "NUMBER" },
                        currency: { type: "STRING" },
                        includeStrategyRetainer: { type: "BOOLEAN" },
                        notes: { type: "STRING" },
                        clientName: { type: "STRING" },
                        clientCompany: { type: "STRING" },
                        clientEmail: { type: "STRING" }
                    }
                }
            },
            {
                name: "saveMemory",
                description: "Store a fact or learned information for use across future sessions.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        content: { type: "STRING", description: "The piece of information to remember." },
                        category: { type: "STRING", description: "Category (e.g. 'client_preference', 'technical_note')." }
                    },
                    required: ["content"]
                }
            },
            {
                name: "searchMemory",
                description: "Recall past information based on a search query.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "The keyword or topic to search for." }
                    },
                    required: ["query"]
                }
            },
            {
                name: "delegateToAgent",
                description: "Delegate a complex sub-task to a specialist agent (researcher, writer, coder, designer, ads_manager).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        agentType: { type: "STRING", enum: ["researcher", "writer", "coder", "designer", "ads_manager"], description: "The type of specialist." },
                        task: { type: "STRING", description: "Detailed mission for the sub-agent." }
                    },
                    required: ["agentType", "task"]
                }
            },
            {
                name: "askUserForInput",
                description: "Ask the user a question to clarify something or get confirmation.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        question: { type: "STRING", description: "The question for the user." }
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
                'createAgencyQuoteArtifacts'
            ],
            plan: ['searchWeb', 'codeMap', 'codeSearch', 'codeFindFn', 'saveMemory', 'searchMemory', 'analyzeMarketingPage', 'scanCompetitors', 'generateSocialCalendar', 'buildAgencyQuotePlan', 'createAgencyQuoteArtifacts'],
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
            const formattedContents = messages.map(msg => {
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

            let systemInstruction = null;
            if (messages[0] && messages[0].role === 'system') {
                systemInstruction = { parts: [{ text: messages[0].content }] };
                formattedContents.shift();
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

            const orderedProviders = mode === 'execute'
                ? [
                    {
                        name: 'OpenRouter',
                        baseUrl: 'https://openrouter.ai/api/v1',
                        apiKey: openRouterApiKey,
                        model: configuredOpenRouterModel,
                        headers: openRouterHeaders
                    },
                    ...fallbackProviders
                ]
                : [
                    {
                        name: 'OpenRouter',
                        baseUrl: 'https://openrouter.ai/api/v1',
                        apiKey: openRouterApiKey,
                        model: this.planOpenRouterModels[0],
                        modelCandidates: [...this.planOpenRouterModels, configuredOpenRouterModel].filter((value, index, array) => value && array.indexOf(value) === index),
                        headers: openRouterHeaders
                    },
                    geminiProvider,
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
                            mode
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
                            tools: [{ functionDeclarations: this.getToolDefinitions(mode) }],
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
                        model: this.modelName
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
