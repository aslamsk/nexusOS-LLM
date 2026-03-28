const { GoogleGenAI } = require('@google/genai');
const ConfigService = require('./core/config');

async function listModels() {
    try {
        const apiKey = await ConfigService.get('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("GEMINI_API_KEY not found.");
            return;
        }
        const genAI = new GoogleGenAI(apiKey);
        // The SDK might have a method to list models, or we can use the REST API
        // For now, let's try a few common ones directly in a ping test
        const models = [
            'imagen-3.0-generate-001',
            'imagen-3.0-generate-002',
            'imagen-3.0-fast-generate-001',
            'imagen-3.0-generate',
            'image-generation-001'
        ];
        
        console.log("Discovery started...");
        for (const m of models) {
            try {
                console.log(`Checking ${m}...`);
                // Use a minimal call to check existence
                await genAI.getGenerativeModel({ model: m });
                console.log(`[FOUND] ${m}`);
            } catch (err) {
                // Ignore errors
            }
        }
    } catch (error) {
        console.error("Discovery failed:", error.message);
    }
}

listModels();
