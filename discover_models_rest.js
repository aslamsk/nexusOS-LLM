const axios = require('axios');
const ConfigService = require('./core/config');

async function listModels() {
    try {
        const apiKey = await ConfigService.get('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("GEMINI_API_KEY not found.");
            return;
        }
        
        console.log("Fetching models via REST API...");
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await axios.get(url);
        
        const models = response.data.models;
        console.log("Available models:");
        models.forEach(m => {
            console.log(`- ${m.name} (${m.displayName})`);
            if (m.name.includes('imagen') || m.name.includes('image')) {
                console.log(`  [POTENTIAL MATCH] ${m.name}`);
            }
        });
    } catch (error) {
        console.error("Discovery failed:", error.response ? error.response.data : error.message);
    }
}

listModels();
