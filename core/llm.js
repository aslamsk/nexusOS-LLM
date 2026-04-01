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
        this.fallbackModels = [
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            'gemini-3.1-pro-preview',
            'gemini-2.0-flash',
            'deep-research-pro-preview-12-2025'
        ];
        this.stopRequested = false;
        this.activeControllers = new Set();
        this.pinnedKeys = new Map(); // [RESILIENCE] sessionId -> successfulKeyName
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
            } catch (_) { }
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
        return new GoogleGenAI({ apiKey, apiVersion: 'v1' });
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
                        savePath: { type: "string", description: "Absolute path to save the .png file." },
                        aspectRatio: { type: "string", enum: ["1:1", "16:9", "9:16", "4:3", "3:4"], description: "The aspect ratio of the generated image. Default is 1:1." },
                        refine: { type: "boolean", description: "Whether to autonomously expand and improve the prompt for higher quality results. Default is true." }
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
                        text: { type: "string", description: "Post text." },
                        imagePath: { type: "string", description: "Optional local image path to attach." }
                    },
                    required: ["urn", "text"]
                }
            },
            {
                name: "linkedinDeletePost",
                description: "Delete the latest or specified LinkedIn organic post.",
                parameters: {
                    type: "object",
                    properties: {
                        postId: { type: "string", description: "LinkedIn post id/URN returned from publish." }
                    }
                }
            },
            {
                name: "xAds",
                description: "Publish organic posts to X (formerly Twitter). Supports text and image paths.",
                parameters: {
                    type: "object",
                    properties: {
                        text: { type: "string", description: "The content of the tweet/post." },
                        imagePath: { type: "string", description: "Optional local path or URL to an image." },
                        boss_approved: { type: "boolean", description: "Set to true once the Boss has seen the draft and given the go-ahead." }
                    },
                    required: ["text"]
                }
            },
            {
                name: "xDeletePost",
                description: "Delete an X post by its public URL.",
                parameters: {
                    type: "object",
                    properties: {
                        postUrl: { type: "string", description: "Public URL of the X post to delete." }
                    }
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
                        body: { type: "string" },
                        attachments: {
                            type: "array",
                            description: "Optional local attachments for the email.",
                            items: {
                                type: "object",
                                properties: {
                                    filename: { type: "string" },
                                    path: { type: "string" }
                                },
                                required: ["path"]
                            }
                        }
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
                name: "listAgenticSkills",
                description: "List all available Standard Operating Procedures (SOPs) from the Antigravity Awesome Skills library.",
                parameters: { type: "object", properties: {} }
            },
            {
                name: "readAgenticSkill",
                description: "Read a specific agentic skill SOP (e.g., '@seo-audit' or '@react-patterns') to load its playbook instructions before performing complex tasks.",
                parameters: {
                    type: "object",
                    properties: {
                        skillName: { type: "string", description: "The name of the skill to read, e.g., @c4-context" }
                    },
                    required: ["skillName"]
                }
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
                'listAgenticSkills',
                'readAgenticSkill',
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
     * Map Nexus messages to Gemini-compatible format.
     */
    formatMessagesForGemini(messages) {
        // IMPORTANT: Gemini v1 expects snake_case keys in request payloads (function_call/function_response).
        // Do not send thought/thought_signature back to the API; it is not part of the request schema.
        return messages.map((msg) => {
            if (msg.role === 'system') {
                return { role: 'user', parts: [{ text: `SYSTEM INSTRUCTION: ${msg.content}` }] };
            }

            if (msg.role === 'assistant') {
                const parts = [];

                // If raw parts exist (from prior provider), only keep text fields to avoid schema violations.
                if (msg.parts && Array.isArray(msg.parts)) {
                    for (const part of msg.parts) {
                        if (part && typeof part.text === 'string' && part.text.trim()) parts.push({ text: part.text });
                    }
                }

                if (msg.content) parts.push({ text: msg.content });
                if (msg.toolCall) {
                    parts.push({
                        function_call: {
                            name: msg.toolCall.name,
                            args: msg.toolCall.args || {}
                        }
                    });
                }
                return { role: 'model', parts };
            }

            if (msg.role === 'tool') {
                return {
                    role: 'user',
                    parts: [{
                        function_response: {
                            name: msg.name,
                            response: { result: msg.content }
                        }
                    }]
                };
            }

            return { role: 'user', parts: [{ text: msg.content }] };
        });
    }

    /**
     * Send conversation history to the LLM and get the next response.
     */
    async generateResponse(messages, options = {}) {
        try {
            this.resetStop();
            const mode = String(options.mode || 'execute').toLowerCase();
            const enableTools = options.enableTools !== false && mode !== 'chat';
            let formattedContents = this.formatMessagesForGemini(messages);

            // CRITICAL BUG FIX: Guard against "contents are required" Google SDK error
            // If empty, inject a default hello to keep the session alive
            if (formattedContents.length === 0) {
                formattedContents = [{ role: 'user', parts: [{ text: 'Hello Nexus.' }] }];
            }

            let systemInstruction = null;
            if (messages[0] && messages[0].role === 'system') {
                const hardenedInstruction = messages[0].content + 
                    "\n\nCRITICAL PROTOCOL: DO NOT ever use text placeholders like [Image: description] or [Video:] in your response. " +
                    "As an autonomous agent, if you do not call the 'generateImage' or 'generateVideo' tools, then the asset DOES NOT EXIST. " +
                    "If you determine an image is needed, you MUST call the tool in the same turn. " +
                    "If you claim the mission is 'Complete', you MUST have performed all required actions via tools first.";
                
                systemInstruction = { parts: [{ text: hardenedInstruction }] };
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
                if (!provider.apiKey && provider.name !== 'Gemini') continue;

                if (provider.name === 'Gemini') {
                    // [RESILIENCE] Integrated Gemini Multi-Key Rotation
                    try {
                        const geminiResponse = await this._generateWithGeminiMultiKey(messages, systemInstruction, mode, enableTools, options);
                        if (geminiResponse && !geminiResponse.text.startsWith('Error calling LLM:')) return geminiResponse;
                        console.warn(`[LLM Gemini Failure] Rotating to backup provider chain...`);
                    } catch (err) {
                        console.error(`[LLM Gemini Fatal Error]`, err.message);
                    }
                    continue;
                }

                const candidateModels = Array.isArray(provider.modelCandidates) && provider.modelCandidates.length
                    ? provider.modelCandidates
                    : [provider.model];

                for (const candidateModel of candidateModels) {
                    try {
                        console.log(`[LLM] Attempting fallback to ${provider.name} using model ${candidateModel}...`);
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

            const quotaMsg = "Nexus OS has exhausted Gemini and no configured fallback provider succeeded. Add a fresh Gemini key or configure OpenRouter, Groq, or NVIDIA fallback settings.";
            console.error(`[LLM Max Retries] ${quotaMsg}`);
            return { text: `MISSION BREACH: API Quota Exhausted. ${quotaMsg}`, toolCall: null };

        } catch (error) {
            console.error("[LLM Error]", error);
            return { text: `Error calling LLM: ${error.message}`, toolCall: null };
        }
    }

    /**
     * [RESILIENCE] Encapsulated Gemini Multi-Key Rotation Logic
     */
    async _generateWithGeminiMultiKey(messages, systemInstruction, mode, enableTools, options) {
        const { sessionId = null } = options;
        const keys = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3'];
        let formattedContents = this.formatMessagesForGemini(messages);
        if (!Array.isArray(formattedContents) || formattedContents.length === 0) {
            formattedContents = [{ role: 'user', parts: [{ text: 'Hello Nexus.' }] }];
        }

        // [RESILIENCE] Use pinned key for session continuity (prevents thought_signature errors)
        const pinnedKey = sessionId ? this.pinnedKeys.get(sessionId) : null;
        const keysToTry = pinnedKey ? [pinnedKey, ...keys.filter(k => k !== pinnedKey)] : keys;

        let currentKeyIdx = 0;
        let currentModelIdx = 0;
        let retryCount = 0;
        const maxRetriesPerKey = 3;
        let delay = 2000;

        while (currentKeyIdx < keysToTry.length) {
            const keyName = keysToTry[currentKeyIdx];
            const ai = await this._getClient(keyName);

            if (!ai) {
                currentKeyIdx++;
                continue;
            }

            const currentModel = this.fallbackModels[currentModelIdx] || this.modelName;

            let innerRetry = 0;
            const maxInnerRetries = 3;
            let delay = 2000;

            while (true) {
                try {
                    // [SDK v1] Use snake_case "function_declarations" for the REST-to-SDK mapping
                    const tools = enableTools ? [{ function_declarations: this.getToolDefinitions(mode) }] : [];

                    // [SDK v1] The @google/genai (Unified SDK) pattern
                    // Use snake_case "system_instruction" with "parts" array
                    const result = await ai.models.generateContent({
                        model: currentModel,
                        contents: formattedContents,
                        system_instruction: systemInstruction || undefined,
                        generationConfig: { temperature: 0.2 },
                        tools: (tools && tools.length > 0) ? tools : undefined
                    });

                    const response = result;

                    if (this.stopRequested) {
                        return { text: 'MISSION STOPPED: Boss cancelled the mission.', toolCall: null, provider: 'Gemini', model: currentModel };
                    }

                    const parts = (response.candidates?.[0]?.content?.parts) || [];
                    const funCallPart = parts.find((p) => p.function_call || p.functionCall);
                    const functionCall = funCallPart?.function_call || funCallPart?.functionCall || (typeof response.functionCalls === 'function' ? response.functionCalls()[0] : null);

                    let textContent = "";
                    if (typeof response.text === 'function') {
                        try { textContent = response.text(); } catch (_) { }
                    } else {
                        textContent = response.text || "";
                    }
                    
                    const finishReason = response.candidates?.[0]?.finishReason;
                    if (finishReason === 'UNEXPECTED_TOOL_CALL') {
                        textContent = "MISSION BREACH: The LLM hallucinated an invalid tool or parameter (UNEXPECTED_TOOL_CALL).";
                    }

                    if (!textContent && !functionCall) {
                        parts.forEach(p => { if (p.text) textContent += p.text; });
                        // [RESILIENCE] If still empty after scanning parts, return a safe fallback
                        // to prevent the orchestrator from crashing and retrying infinitely.
                        if (!textContent) {
                            console.warn(`[LLM] Empty response from ${currentModel}. Returning safe fallback.`);
                            return {
                                text: "I received an empty response from the AI model. This can happen due to content filtering or a model glitch. Please try rephrasing your request or try again in a moment.",
                                thought: null, thoughtSignature: null, parts: [],
                                toolCall: null, provider: 'Gemini', model: currentModel,
                                usage: this._extractUsage(response.usageMetadata || {})
                            };
                        }
                    }

                    // [RESILIENCE] Pin successful key for this session
                    if (sessionId) {
                        this.pinnedKeys.set(sessionId, keyName);
                    }

                    return {
                        text: textContent,
                        parts,
                        toolCall: functionCall ? { name: functionCall.name, args: functionCall.args || {} } : null,
                        provider: 'Gemini',
                        model: currentModel,
                        usage: this._extractUsage(response.usageMetadata || response.usage || {})
                    };

                } catch (error) {
                    if (this.stopRequested) {
                        return { text: 'MISSION STOPPED: Boss cancelled the mission.', toolCall: null, provider: 'Gemini', model: currentModel };
                    }

                    const errorMsg = String(error.message || error).toLowerCase();

                    // [CIRCUIT BREAKER] Detect empty-output SDK errors (not retryable, return gracefully)
                    const isEmptyOutputError = errorMsg.includes('model output must contain') || 
                                               errorMsg.includes('output text or tool calls') ||
                                               errorMsg.includes('both be empty');
                    if (isEmptyOutputError) {
                        console.warn(`[LLM] Empty output SDK error from ${currentModel}. Returning safe fallback to prevent infinite loop.`);
                        return {
                            text: "⚠️ The AI model returned an empty response (likely due to content filtering or a safety block). Please rephrase your request and try again.",
                            thought: null, thoughtSignature: null, parts: [],
                            toolCall: null, provider: 'Gemini', model: currentModel,
                            usage: {}
                        };
                    }

                    const isRateLimit = errorMsg.includes('429') || errorMsg.includes('resource_exhausted');
                    const isTransient = errorMsg.includes('500') || errorMsg.includes('timeout') || errorMsg.includes('unavailable') || errorMsg.includes('internal');
                    const isModelError = errorMsg.includes('404') || errorMsg.includes('not found');

                    if (isModelError && currentModelIdx < this.fallbackModels.length - 1) {
                        console.warn(`[LLM Warning] Model ${currentModel} failed: ${errorMsg}. Rotating to next fallback...`);
                        currentModelIdx++;
                        break; // Break inner loop to pick up new model in outer loop
                    }

                    if ((isRateLimit || isTransient) && innerRetry < maxInnerRetries) {
                        innerRetry++;
                        const delayMs = isRateLimit ? Math.pow(2, innerRetry) * 1000 : delay;
                        console.warn(`[LLM] Gemini Error (${errorMsg}). Retrying ${keyName} in ${delayMs}ms... (Attempt ${innerRetry}/${maxInnerRetries})`);
                        await new Promise(r => setTimeout(r, delayMs));
                        continue;
                    }

                    // If we exhausted retries or hit a non-retryable error, try rotating the key
                    if (currentKeyIdx < keysToTry.length - 1) {
                        console.warn(`[LLM] Key ${keyName} failing consistently. Rotating to next Gemini key...`);
                        currentKeyIdx++;
                        currentModelIdx = 0;
                        break; // Break inner loop to try next key in outer loop
                    }

                    throw error;
                }
            }
        }
        return null;
    }
}

module.exports = LLMService;
