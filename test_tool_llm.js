const { db } = require('./core/firebase');
const ConfigService = require('./core/config');
const LLMService = require('./core/llm');
async function test() {
    const llm = new LLMService();
    const context = [
        { role: 'system', content: 'You are Nexus. You must use the browserAction tool.' },
        { role: 'user', content: 'open https://teluguloislamahamed.com/playquiz/2026-03-31' }
    ];
    // Now call with execute mode
    const result = await llm.generateResponse(context, { mode: 'execute', enableTools: true });
    console.log("RESULT STR:", JSON.stringify(result, null, 2));
    process.exit(0);
}
test().catch(console.error);
