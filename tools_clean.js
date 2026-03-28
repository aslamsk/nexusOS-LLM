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
