const { GoogleGenAI } = require('@google/genai');
const ConfigService = require('../core/config');

async function listModels() {
    const apiKey = await ConfigService.get('GEMINI_API_KEY');
    if (!apiKey) {
        console.error('GEMINI_API_KEY not found in config');
        return;
    }
    
    // Try both v1 and v1beta
    const versions = ['v1', 'v1beta'];
    
    for (const version of versions) {
        console.log(`\n--- Listing Models for API Version: ${version} ---`);
        try {
            const ai = new GoogleGenAI({ apiKey, apiVersion: version });
            // The listModels method might be on the client or requires a specific fetch
            // In the JS SDK, listing models usually involves a direct fetch or a specific method if available
            // If the SDK doesn't expose it easily, we can use axios
            const axios = require('axios');
            const url = `https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`;
            const response = await axios.get(url);
            
            if (response.data && response.data.models) {
                response.data.models.forEach(m => {
                    if (m.supportedGenerationMethods.includes('generateContent')) {
                        console.log(`- ${m.name} (${m.displayName})`);
                    }
                });
            } else {
                console.log('No models found or error in response structure.');
            }
        } catch (err) {
            console.error(`Error listing models for ${version}:`, err.response?.data || err.message);
        }
    }
}

listModels();
