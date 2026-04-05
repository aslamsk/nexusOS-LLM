const ConfigService = require('./config');
const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const IDEBridge = require('./bridge');

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
        this.providerPins = new Map(); // [RESILIENCE] sessionId -> preferred provider for the rest of the run
        this.geminiCooldownUntil = 0;
        this.readFileState = new Map(); // [CLAUDE-STALENESS-GUARD] absolutePath -> { timestamp, contentHash, lastReadTurn }
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

    _buildProviderChain({ geminiProvider, openRouterPrimary, fallbackProviders = [], pinnedProvider = null }) {
        const orderedProviders = [
            geminiProvider,
            openRouterPrimary,
            ...fallbackProviders
        ];

        if (!pinnedProvider) return orderedProviders;

        return orderedProviders
            .filter((provider) => provider.name === pinnedProvider)
            .concat(orderedProviders.filter((provider) => provider.name !== pinnedProvider));
    }

    _isGeminiCoolingDown(now = Date.now()) {
        return Number(this.geminiCooldownUntil || 0) > now;
    }

    _startGeminiCooldown(durationMs = 10 * 60 * 1000) {
        this.geminiCooldownUntil = Date.now() + Math.max(1000, Number(durationMs || 0));
        return this.geminiCooldownUntil;
    }

    /**
     * Get an initialized Gemini client with a specific API key.
     */
    async _getClient(keyName = 'GEMINI_API_KEY') {
        const apiKey = await ConfigService.get(keyName);
        if (!apiKey) return null;
        return new GoogleGenAI({ apiKey, apiVersion: 'v1' });
    }

    _getOpenAITools(options = {}) {
        return this.getToolDefinitions('execute', options).map((tool) => ({
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

    async _generateWithOpenAICompatible({ providerName, baseUrl, apiKey, model, headers = {}, messages, mode = 'execute', enableTools = true, allowedTools = null }) {
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
                    tools: this.getToolDefinitions(mode, { allowedTools }).map((tool) => ({
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
    getToolDefinitions(mode = 'execute', options = {}) {
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
                            enum: ["open", "click", "clickPixel", "clickText", "type", "clearAndType", "fillByLabel", "focus", "keyPress", "hover", "scroll", "extract", "extractActiveElements", "getMarkdown", "screenshot", "waitForNetworkIdle", "waitForSelector", "dismissInterruptions"],
                            description: "The action to perform. Use only supported browser actions. Prefer 'open' for navigation, 'waitForSelector' to confirm page state, 'clearAndType' for stable selectors, 'fillByLabel' when labels/placeholders are more reliable than selectors, 'getMarkdown' for a hierarchical page view, 'extractActiveElements' for interactive items with coordinates, 'dismissInterruptions' to clear cookie banners/modals/app prompts, and 'clickPixel' only if CSS selectors fail."
                        },
                        url: { type: "string", description: "URL to open (for 'open')." },
                        selector: { type: "string", description: "CSS selector (for 'click', 'type', 'hover', 'scroll', 'extract')." },
                        label: { type: "string", description: "Human-visible field label, placeholder, or aria-label (for 'fillByLabel')." },
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
                name: "runSed",
                description: "Apply a regex replacement to a file (stream editing). Use this for complex multi-line patterns or global replacements.",
                parameters: {
                    type: "object",
                    properties: {
                        absolutePath: { type: "string", description: "Path to the file." },
                        pattern: { type: "string", description: "The regex pattern to search for." },
                        replacement: { type: "string", description: "The replacement content." }
                    },
                    required: ["absolutePath", "pattern", "replacement"]
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

        const explicitAllowedTools = Array.isArray(options.allowedTools) && options.allowedTools.length
            ? new Set(options.allowedTools)
            : null;
        const allowed = explicitAllowedTools || new Set(toolNamesByMode[mode] || toolNamesByMode.execute);
        return allTools.filter((tool) => allowed.has(tool.name));
    }

    /**
     * Map Nexus messages to Gemini-compatible format.
     */
    formatMessagesForGemini(messages) {
        // Do not send thought/thought_signature back to the API; it is not part of the request schema.
        // The Gemini request payload here must use snake_case tool parts.
        const formatted = messages.map((msg) => {
            if (msg.role === 'system') {
                const systemText = typeof msg.content === 'string' ? msg.content.trim() : String(msg.content ?? '').trim();
                return systemText ? { role: 'user', parts: [{ text: `SYSTEM INSTRUCTION: ${systemText}` }] } : null;
            }

            if (msg.role === 'assistant') {
                const parts = [];

                // If raw parts exist (from prior provider), only keep text fields to avoid schema violations.
                if (msg.parts && Array.isArray(msg.parts)) {
                    for (const part of msg.parts) {
                        if (part && typeof part.text === 'string' && part.text.trim()) parts.push({ text: part.text });
                    }
                }

                const assistantText = typeof msg.content === 'string'
                    ? msg.content.trim()
                    : '';
                if (assistantText) parts.push({ text: assistantText });
                if (msg.toolCall) {
                    parts.push({
                        function_call: {
                            name: msg.toolCall.name,
                            args: msg.toolCall.args || {}
                        }
                    });
                }
                return parts.length ? { role: 'model', parts } : null;
            }

            if (msg.role === 'tool') {
                const resultContent = typeof msg.content === 'string'
                    ? msg.content
                    : JSON.stringify(msg.content ?? '');
                return {
                    role: 'user',
                    parts: [{
                        function_response: {
                            name: msg.name,
                            response: { result: resultContent }
                        }
                    }]
                };
            }

            const text = typeof msg.content === 'string'
                ? msg.content.trim()
                : String(msg.content ?? '').trim();
            return text ? { role: 'user', parts: [{ text }] } : null;
        });

        return formatted.filter((entry) =>
            entry &&
            Array.isArray(entry.parts) &&
            entry.parts.length > 0 &&
            entry.parts.some((part) =>
                (typeof part.text === 'string' && part.text.trim()) ||
                part.function_call ||
                part.function_response
            )
        );
    }

    /**
     * Main Autonomous Turn Loop (QueryEngine)
     * Mirrors Claude Code's execution lifecycle.
     */
    async *executeLoop(prompt, options = {}) {
        const { sessionId, systemPrompt: customSystem, maxTurns = 10 } = options;
        
        // ─── [LSP] IDE Context Injection ───
        let ideContext = "";
        if (sessionId) {
            const bridgeStatus = IDEBridge.getStatus();
            if (bridgeStatus.activeCount > 0) {
                // Fetch the most recent state for this session if available
                const session = IDEBridge.sessions.get(sessionId);
                if (session && session.latestState) {
                    const { activeFile, cursorLine, selections } = session.latestState;
                    ideContext = `\n[IDE_CONTEXT] User is currently viewing: ${activeFile || 'unknown'} at line ${cursorLine || 1}.\n`;
                }
            }
        }

        const systemPrompt = (customSystem || this.systemPrompt) + ideContext;
        // ... (rest of loop implementation)
    }

    /**
     * Send conversation history to the LLM and get the next response.
     */
    async generateResponse(messages, options = {}) {
        try {
            this.resetStop();
            const sessionId = options.sessionId || null;
            const onStatus = typeof options.onStatus === 'function' ? options.onStatus : null;
            const mode = String(options.mode || 'execute').toLowerCase();
            const enableTools = options.enableTools !== false && mode !== 'chat';
            const allowedTools = Array.isArray(options.allowedTools) && options.allowedTools.length
                ? options.allowedTools
                : null;
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

            const pinnedProvider = sessionId ? this.providerPins.get(sessionId) : null;
            const providerChain = this._buildProviderChain({
                geminiProvider,
                openRouterPrimary,
                fallbackProviders,
                pinnedProvider
            });

            for (const provider of providerChain) {
                if (!provider.apiKey && provider.name !== 'Gemini') continue;

                if (provider.name === 'Gemini') {
                    if (this._isGeminiCoolingDown()) {
                        const remainingSeconds = Math.max(1, Math.ceil((this.geminiCooldownUntil - Date.now()) / 1000));
                        if (onStatus) onStatus(`Gemini cooldown active. Skipping Gemini for ${remainingSeconds}s and using fallback providers...`);
                        continue;
                    }
                    // [RESILIENCE] Integrated Gemini Multi-Key Rotation
                    try {
                        const geminiResponse = await this._generateWithGeminiMultiKey(messages, systemInstruction, mode, enableTools, options);
                        if (geminiResponse && !geminiResponse.text.startsWith('Error calling LLM:')) return geminiResponse;
                        console.warn(`[LLM Gemini Failure] Rotating to backup provider chain...`);
                        if (sessionId) this.providerPins.set(sessionId, 'OpenRouter');
                        this._startGeminiCooldown();
                        if (onStatus) onStatus('Gemini failed for this turn. Pinning this session to fallback provider...');
                    } catch (err) {
                        console.error(`[LLM Gemini Fatal Error]`, err.message);
                        if (sessionId) this.providerPins.set(sessionId, 'OpenRouter');
                        this._startGeminiCooldown();
                        if (onStatus) onStatus('Gemini quota/error detected. Pinning this session to fallback provider...');
                    }
                    continue;
                }

                const candidateModels = Array.isArray(provider.modelCandidates) && provider.modelCandidates.length
                    ? provider.modelCandidates
                    : [provider.model];

                for (const candidateModel of candidateModels) {
                    try {
                        console.log(`[LLM] Attempting fallback to ${provider.name} using model ${candidateModel}...`);
                        if (onStatus) onStatus(`Trying fallback provider ${provider.name} with model ${candidateModel}...`);
                        const fallbackResponse = await this._generateWithOpenAICompatible({
                            providerName: provider.name,
                            baseUrl: provider.baseUrl,
                            apiKey: provider.apiKey,
                            model: candidateModel,
                            headers: provider.headers,
                            messages,
                            mode,
                            enableTools,
                            allowedTools
                        });
                        if (fallbackResponse) {
                            if (sessionId && provider.name === 'OpenRouter') this.providerPins.set(sessionId, 'OpenRouter');
                            return fallbackResponse;
                        }
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
        const onStatus = typeof options.onStatus === 'function' ? options.onStatus : null;
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
                    // The JS SDK expects camelCase request properties.
                    const tools = enableTools ? [{ functionDeclarations: this.getToolDefinitions(mode, { allowedTools: options.allowedTools }) }] : [];

                    // The JS SDK expects systemInstruction in camelCase.
                    const result = await ai.models.generateContent({
                        model: currentModel,
                        contents: formattedContents,
                        systemInstruction: systemInstruction || undefined,
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
                        if (onStatus) onStatus(`Gemini quota/backoff on ${keyName}. Retrying in ${Math.round(delayMs / 1000)}s (attempt ${innerRetry}/${maxInnerRetries})...`);
                        await new Promise(r => setTimeout(r, delayMs));
                        continue;
                    }

                    // If we exhausted retries or hit a non-retryable error, try rotating the key
                    if (currentKeyIdx < keysToTry.length - 1) {
                        console.warn(`[LLM] Key ${keyName} failing consistently. Rotating to next Gemini key...`);
                        if (onStatus) onStatus(`Gemini key ${keyName} exhausted. Rotating to next key...`);
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

    /**
     * [CLAUDE-CONTEXT-COMPACTION]
     * Summarize older parts of the conversation to stay within token limits.
     */
    async compactContext(messages) {
        if (messages.length < 10) return messages;

        console.log(`[LLM] Initiating Context Compaction... (Current size: ${messages.length} msgs)`);
        
        // Keep system prompt and last 4 turns (8 messages)
        const systemPrompt = messages[0].role === 'system' ? messages[0] : null;
        const recentMessages = messages.slice(-8);
        const toSummarize = messages.slice(systemPrompt ? 1 : 0, -8);

        if (toSummarize.length === 0) return messages;

        const summaryPrompt = `Please summarize the following conversation history into a concise list of "Facts Learned" and "Actions Performed". Keep it under 300 words:\n\n${JSON.stringify(toSummarize)}`;
        
        try {
            const summary = await this.generateResponse([{ role: 'user', content: summaryPrompt }], { mode: 'chat' });
            const compactMessage = { 
                role: 'user', 
                content: `### CONVERSATION SUMMARY (AUTO-COMPACTED):\n${summary.text}\n\n[Continuing mission from here...]` 
            };

            return systemPrompt ? [systemPrompt, compactMessage, ...recentMessages] : [compactMessage, ...recentMessages];
        } catch (e) {
            console.warn(`[LLM] Compaction failed: ${e.message}. Falling back to raw context.`);
            return messages;
        }
    }

    /**
     * [CLAUDE-QUERY-ENGINE]
     * Autonomous execution loop that handles thinking, tool calls, and results.
     */
    async *executeLoop(messages, options = {}, toolDispatcher = {}) {
        const { sessionId } = options;
        let currentMessages = [...messages];
        
        // ─── [LSP] IDE Context Injection ───
        if (sessionId) {
            const bridgeStatus = IDEBridge.getStatus();
            if (bridgeStatus.activeCount > 0) {
                const session = IDEBridge.sessions.get(sessionId);
                if (session && session.latestState) {
                    const { activeFile, cursorLine } = session.latestState;
                    const ideContext = `\n[IDE_CONTEXT] Boss is currently viewing: ${activeFile || 'unknown'} at line ${cursorLine || 1}.\n`;
                    // Inject into the first prompt if not already present
                    if (currentMessages.length > 0) {
                        currentMessages[0].content += ideContext;
                    }
                }
            }
        }

        let turn = 0;
        const maxTurns = options.maxTurns || 10;

        while (turn < maxTurns) {
            turn++;
            
            // Auto-compact before every turn if it's getting long
            if (currentMessages.length > 25) {
                currentMessages = await this.compactContext(currentMessages);
            }

            const response = await this.generateResponse(currentMessages, options);
            yield { type: 'thought', text: response.text, turn };

            if (!response.toolCall) {
                yield { type: 'done', text: response.text };
                break;
            }

            const toolName = response.toolCall.name;
            const toolArgs = response.toolCall.args;
            
            yield { type: 'call', name: toolName, args: toolArgs, turn };

            // Execute tool via dispatcher
            let result;
            if (toolDispatcher[toolName]) {
                try {
                    result = await toolDispatcher[toolName](toolArgs);
                } catch (e) {
                    result = `Error executing tool ${toolName}: ${e.message}`;
                }
            } else {
                result = `Error: Tool '${toolName}' not found in dispatcher.`;
            }

            yield { type: 'result', name: toolName, result, turn };

            // [CLAUDE-BUDGET-TRACKING] Accumulate costs
            const turnUsage = response.usage || {};
            const turnCost = this._estimateCost(response.model, turnUsage);
            options.cumulativeCost = (options.cumulativeCost || 0) + turnCost;

            yield { type: 'usage', model: response.model, usage: turnUsage, turnCost, totalCost: options.cumulativeCost, turn };

            // Update context for next turn
            currentMessages.push({ role: 'assistant', content: response.text, toolCall: response.toolCall });
            currentMessages.push({ role: 'tool', name: toolName, content: String(result) });
        }

        if (turn >= maxTurns) {
            yield { type: 'error', message: `Max Turn Limit (${maxTurns}) reached.` };
        }
    }

    _estimateCost(model, usage) {
        const inputTokens = usage.inputTokens || 0;
        const outputTokens = usage.outputTokens || 0;
        
        // Simple heuristic rates per 1M tokens (Claude/Gemini approximate)
        const rates = {
            'gemini-1.5-pro': { in: 3.5, out: 10.5 },
            'gemini-1.5-flash': { in: 0.075, out: 0.30 },
            'claude-3-5-sonnet': { in: 3.0, out: 15.0 },
            'claude-3-opus': { in: 15.0, out: 75.0 }
        };

        const rate = Object.entries(rates).find(([k]) => model.toLowerCase().includes(k))?.[1] || { in: 1.0, out: 5.0 };
        return (inputTokens / 1_000_000 * rate.in) + (outputTokens / 1_000_000 * rate.out);
    }
}

module.exports = LLMService;
