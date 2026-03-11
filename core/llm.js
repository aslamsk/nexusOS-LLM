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
