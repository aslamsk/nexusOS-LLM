const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

async function listModels() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("GEMINI_API_KEY not found in .env");
            return;
        }
        const genAI = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
        
        // The SDK doesn't have a direct listModels helper that works similarly to generateContent in some versions
        // But we can try to hit the endpoint or just guess standard names
        console.log("Testing gemini-1.5-flash...");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent("test");
            console.log("gemini-1.5-flash works!");
        } catch (e) {
            console.log("gemini-1.5-flash FAILED:", e.message);
        }

        console.log("Testing gemini-1.5-flash-latest...");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
            const result = await model.generateContent("test");
            console.log("gemini-1.5-flash-latest works!");
        } catch (e) {
            console.log("gemini-1.5-flash-latest FAILED:", e.message);
        }

        console.log("Testing gemini-2.0-flash-exp...");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
            const result = await model.generateContent("test");
            console.log("gemini-2.0-flash-exp works!");
        } catch (e) {
            console.log("gemini-2.0-flash-exp FAILED:", e.message);
        }

    } catch (error) {
        console.error("List models error:", error);
    }
}

listModels();
