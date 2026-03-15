require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

/**
 * Nexus OS: LLM Subsystem
 * Encapsulates the interaction with the Gemini API.
 */
class LLMService {
    constructor() {
        // Initialize the Gemini client
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn("[Nexus OS Warning] GEMINI_API_KEY is not set in the environment. LLM calls will fail.");
        }

        this.ai = new GoogleGenAI({ apiKey: apiKey });
        this.modelName = 'gemini-2.5-flash';
    }

    /**
     * Define the tools available to the LLM.
     * These definitions must match the tools registered in the Orchestrator.
     */
    getToolDefinitions() {
        return [
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
                description: "Perform an action using the browser sub-agent.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", description: "Action to perform: 'open', 'click', 'type', 'extract', 'screenshot'" },
                        url: { type: "STRING", description: "URL to open (for 'open')." },
                        selector: { type: "STRING", description: "CSS selector (for 'click', 'type', 'extract')." },
                        text: { type: "STRING", description: "Text to type (for 'type')." },
                        savePath: { type: "STRING", description: "Path to save screenshot (for 'screenshot')." }
                    },
                    required: ["action"]
                }
            },
            {
                name: "generateImage",
                description: "Generate an image using Imagen 3 based on a text prompt.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        prompt: { type: "STRING", description: "Text description of the image." },
                        savePath: { type: "STRING", description: "Absolute path where the image should be saved." }
                    },
                    required: ["prompt", "savePath"]
                }
            },
            {
                name: "askUserForInput",
                description: "Ask the user a question to get more information or confirmation before proceeding.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        question: { type: "STRING", description: "The question to ask the user." }
                    },
                    required: ["question"]
                }
            },
            {
                name: "metaCreateCampaign",
                description: "Create a new Meta Ads Campaign.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        name: { type: "STRING", description: "Name of the campaign." },
                        objective: { type: "STRING", description: "Campaign objective (e.g., 'OUTCOME_TRAFFIC'). Defaults to 'OUTCOME_TRAFFIC'." }
                    },
                    required: ["name"]
                }
            },
            {
                name: "metaCreateAdSet",
                description: "Create a new Meta Ad Set with budget and targeting.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        campaignId: { type: "STRING", description: "ID of the parent campaign." },
                        name: { type: "STRING", description: "Name of the ad set." },
                        budget: { type: "NUMBER", description: "Daily budget in Rupees (e.g., 100)." },
                        targeting: { type: "OBJECT", description: "Targeting object (e.g., {geo_locations: {countries: ['IN']}})." }
                    },
                    required: ["campaignId", "name", "budget"]
                }
            },
            {
                name: "metaUploadImage",
                description: "Upload a local image to Meta to get an image_hash.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        imagePath: { type: "STRING", description: "Absolute path to the local image file." }
                    },
                    required: ["imagePath"]
                }
            },
            {
                name: "metaCreateCreative",
                description: "Create a new Meta Ad Creative.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        name: { type: "STRING", description: "Internal name for the creative." },
                        title: { type: "STRING", description: "The headline of the ad (e.g. 'MK Fashion - Luxury Silk Saree')." },
                        body: { type: "STRING", description: "The main text/description of the ad." },
                        imageHash: { type: "STRING", description: "The hash returned by 'metaUploadImage'." },
                        pageId: { type: "STRING", description: "The Facebook Page ID. Optional." },
                        cta: { type: "STRING", description: "The Call to Action type, e.g., 'SHOP_NOW', 'WHATSAPP_MESSAGE', 'LEARN_MORE'. Default is 'SHOP_NOW'." }
                    },
                    required: ["name", "title", "body", "imageHash"]
                }
            },
            {
                name: "metaPublishOrganicVideo",
                description: "Publish a free, organic video post to a Facebook Page feed. Uses META_PAGE_ID from .env if pageId is missing.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        pageId: { type: "STRING", description: "The Facebook Page ID. Optional." },
                        title: { type: "STRING", description: "Title of the video." },
                        description: { type: "STRING", description: "Description for the video." },
                        videoPath: { type: "STRING", description: "Absolute path to the local video file." }
                    },
                    required: ["title", "description", "videoPath"]
                }
            },
            {
                name: "metaPublishOrganicReel",
                description: "Publish a free, organic Reel to a Facebook Page. Uses META_PAGE_ID from .env if pageId is missing.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        pageId: { type: "STRING", description: "The Facebook Page ID. Optional." },
                        description: { type: "STRING", description: "Caption for the Reel." },
                        videoPath: { type: "STRING", description: "Absolute path to the local video file." }
                    },
                    required: ["description", "videoPath"]
                }
            },
            {
                name: "metaCreateAd",
                description: "Create the final Ad on Meta.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        adSetId: { type: "STRING", description: "ID of the parent ad set." },
                        creativeId: { type: "STRING", description: "ID of the ad creative." },
                        name: { type: "STRING", description: "Name of the ad." }
                    },
                    required: ["adSetId", "creativeId", "name"]
                }
            },
            {
                name: "metaPublishOrganicPost",
                description: "Publish a free, organic text post to a Facebook Page feed. Uses META_PAGE_ID from .env if pageId is missing.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        pageId: { type: "STRING", description: "The Facebook Page ID. Optional." },
                        message: { type: "STRING", description: "The text of the post." },
                        link: { type: "STRING", description: "Optional link to include." }
                    },
                    required: ["message"]
                }
            },
            {
                name: "metaPublishOrganicPhoto",
                description: "Publish a free, organic photo post to a Facebook Page feed. Uses META_PAGE_ID from .env if pageId is missing.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        pageId: { type: "STRING", description: "The Facebook Page ID. Optional." },
                        message: { type: "STRING", description: "Caption for the photo." },
                        imagePath: { type: "STRING", description: "Absolute path to the local image file." }
                    },
                    required: ["message", "imagePath"]
                }
            },
            {
                name: "metaGetPageInsights",
                description: "Get engagement insights (impressions, engagement, fans) for a Facebook Page. Uses META_PAGE_ID from .env if pageId is missing.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        pageId: { type: "STRING", description: "The Facebook Page ID. Optional." }
                    }
                }
            },
            {
                name: "generateVideo",
                description: "Convert a static image into a 5-second video MP4 file suitable for Reels.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        imagePath: { type: "STRING", description: "Absolute path to the source image." },
                        outputPath: { type: "STRING", description: "Absolute path for the output .mp4 file." }
                    },
                    required: ["imagePath", "outputPath"]
                }
            },
            {
                name: "metaGetComments",
                description: "Get comments for a specific Meta object (Post ID or Ad ID).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        objectId: { type: "STRING", description: "The ID of the post or ad to fetch comments for." }
                    },
                    required: ["objectId"]
                }
            },
            {
                name: "metaReplyToComment",
                description: "Reply to a specific comment on a Meta Page post.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        commentId: { type: "STRING", description: "The ID of the comment to reply to." },
                        message: { type: "STRING", description: "The text of the reply." }
                    },
                    required: ["commentId", "message"]
                }
            },
            {
                name: "metaGetAccountInfo",
                description: "Get details about the configured Meta Ad Account.",
                parameters: {
                    type: "OBJECT",
                    properties: {}
                }
            }
        ];
    }

    /**
     * Send the conversation history to the LLM and get the next response.
     */
    async generateResponse(messages) {
        try {
            const formattedContents = messages.map(msg => {
                if (msg.role === 'system') {
                    // Gemini doesn't have a distinct system message in the same way, 
                    // we can pass systemInstructions in the config or prepend it.
                    // For simplicity here, we treat it as user if not supported directly, or pass via config
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
                        role: 'user', // Tool responses are typically sent as user messages with functionResponse
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

            // If the first message is the system prompt, we extract it.
            let systemInstruction = null;
            if (messages[0] && messages[0].role === 'system') {
                systemInstruction = {
                    parts: [{ text: messages[0].content }]
                };
                formattedContents.shift(); // Remove from contents
            }

            const response = await this.ai.models.generateContent({
                model: this.modelName,
                contents: formattedContents,
                config: {
                    systemInstruction: systemInstruction,
                    tools: [{ functionDeclarations: this.getToolDefinitions() }],
                    temperature: 0.2
                }
            });

            const functionCall = response.functionCalls?.[0];
            const textContent = response.text;

            return {
                text: textContent,
                toolCall: functionCall ? { name: functionCall.name, args: functionCall.args } : null
            };

        } catch (error) {
            console.error("[LLM Error]", error);
            return {
                text: `Error calling LLM: ${error.message}`,
                toolCall: null
            };
        }
    }
}

module.exports = LLMService;
