const { db } = require('./core/firebase');
const ConfigService = require('./core/config');
const LLMService = require('./core/llm');
async function test() {
    const llm = new LLMService();
    const systemInstruction = "You are Nexus.";
    const user1 = "System Info:\nMemory: none\n=== GOAL ===\nhi";
    
    const context = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: user1 },
        { role: 'assistant', parts: [{ text: 'Hello! How can I help you today?' }] },
        { role: 'user', content: 'what is today petrol cost in ANDHRA PRADESH' }
    ];
    // In chat mode, enableTools is false
    const result = await llm.generateResponse(context, { mode: 'chat', enableTools: false });
    console.log("RESULT STR:", JSON.stringify(result, null, 2));
    process.exit(0);
}
test().catch(console.error);
