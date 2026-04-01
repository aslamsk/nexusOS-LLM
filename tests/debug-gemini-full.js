const { GoogleGenAI } = require('@google/genai');
const ConfigService = require('../core/config');

async function debugGeminiFull() {
    const apiKey = await ConfigService.get('GEMINI_API_KEY');
    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    const model = ai.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });

    const prompt = "open https://teluguloislamahamed.com/playquiz/2026-03-23 if any details asked enter name : Shafi, Mobile: 8885202721, City: Ongole, submit and quiz will be opened read all questions 1 by 1 and give correct answers and submit do not close it";
    
    console.log('--- Calling Gemini 3.1 Raw ---');
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ functionDeclarations: [
            {
                name: "browserAction",
                description: "Full web automation",
                parameters: {
                    type: "object",
                    properties: {
                        action: { type: "string" },
                        url: { type: "string" }
                    },
                    required: ["action"]
                }
            }
        ]}]
    });

    console.log('--- Raw Response Candidates ---');
    console.log(JSON.stringify(result.response.candidates, null, 2));

    process.exit(0);
}

debugGeminiFull().catch(err => {
    console.error(err);
    process.exit(1);
});
