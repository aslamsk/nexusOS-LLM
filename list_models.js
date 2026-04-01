const { GoogleGenAI } = require('@google/genai');
const ConfigService = require('./core/config');

async function list() {
    const apiKey = await ConfigService.get('GEMINI_API_KEY');
    const ai = new GoogleGenAI({ apiKey });
    
    console.log("Discovering models via ai.models.list()...");
    try {
        // Attempting the most likely method in v1.44.0
        const result = await ai.getModels();
        console.log("DISCOVERED MODELS (v1):", JSON.stringify(result, null, 2));
    } catch (e) {
        console.log("v1 failed. Trying ai.models.list()...");
        try {
            const result = await ai.models.list();
            console.log("DISCOVERED MODELS (v2):", JSON.stringify(result, null, 2));
        } catch (e2) {
            console.log("All methods failed. Error:", e2.message);
        }
    }
}

list().catch(console.error);
