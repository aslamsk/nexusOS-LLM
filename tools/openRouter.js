const ConfigService = require('../core/config');
const axios = require('axios');

class OpenRouterTool {
    constructor() {
        this.baseUrl = 'https://openrouter.ai/api/v1';
    }

    /**
     * Sends a chat completion request to OpenRouter.
     * @param {string} prompt - The user prompt.
     * @param {string} model - The model ID (e.g., 'nvidia/nemotron-nano-12b-v2-vl:free').
     */
    async chat(prompt, model = 'nvidia/nemotron-nano-12b-v2-vl:free') {
        const apiKey = await ConfigService.get('OPENROUTER_API_TOKEN');
        if (!apiKey) {
            return { error: "OPENROUTER_API_TOKEN missing in Firestore" };
        }

        console.log(`[OpenRouter] Sending request to model: ${model}`);
        try {
            const response = await axios.post(
                `${this.baseUrl}/chat/completions`,
                {
                    model: model,
                    messages: [{ role: 'user', content: prompt }]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'HTTP-Referer': 'https://nexus-os.local', // Required by OpenRouter
                        'X-Title': 'Nexus OS', // Required by OpenRouter
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                success: true,
                message: response.data.choices[0].message.content,
                model: response.data.model
            };
        } catch (error) {
            console.error("[OpenRouter Error]", error.response?.data || error.message);
            return {
                error: "OpenRouter request failed",
                details: error.response?.data || error.message
            };
        }
    }

    /**
     * Lists available free models on OpenRouter.
     */
    async listFreeModels() {
        try {
            const response = await axios.get(`${this.baseUrl}/models`);
            const freeModels = response.data.data.filter(m => m.id.includes(':free'));
            return freeModels.map(m => ({ id: m.id, name: m.name }));
        } catch (error) {
            return { error: "Failed to list models", details: error.message };
        }
    }
}

module.exports = new OpenRouterTool();
