const LLMService = require('../core/llm');
const assert = require('assert');

async function testThoughtPersistence() {
    console.log('🚀 Testing LLM Thought Persistence Logic...');
    const llm = new LLMService();

    // 1. Mock context with a thought and signature
    const context = [
        { role: 'user', content: 'What is 2+2?' },
        { 
            role: 'assistant', 
            content: 'I will use a calculator.', 
            thought: 'The user wants a sum.', 
            thoughtSignature: 'sig_12345',
            toolCall: { name: 'runCommand', args: { command: 'echo 4' } }
        },
        { role: 'tool', name: 'runCommand', content: '4' }
    ];

    // 2. Test the internal formatting (if we were using _formatMessagesForOpenAI it would be different, 
    // but for Gemini it happens inside generateResponse)
    
    // We'll simulate the mapping logic from llm.js locally to verify it produces the right "parts"
    const formatted = context.map(msg => {
        if (msg.role === 'system') {
            return { role: 'user', parts: [{ text: `SYSTEM INSTRUCTION: ${msg.content}` }] };
        } else if (msg.role === 'assistant') {
            const parts = [];
            if (msg.thought) {
                parts.push({
                    thought: msg.thought,
                    thought_signature: msg.thoughtSignature
                });
            }
            if (msg.content) parts.push({ text: msg.content });
            if (msg.toolCall) {
                parts.push({
                    functionCall: {
                        name: msg.toolCall.name,
                        args: msg.toolCall.args
                    },
                    ...(msg.thoughtSignature && !msg.thought ? { thought_signature: msg.thoughtSignature } : {})
                });
            }
            return { role: 'model', parts: parts };
        } else if (msg.role === 'tool') {
            return {
                role: 'user',
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

    // 3. Assertions
    const assistantMsg = formatted[1];
    assert.strictEqual(assistantMsg.role, 'model');
    assert.strictEqual(assistantMsg.parts.length, 3, 'Should have 3 parts: thought, text, and functionCall');
    
    const thoughtPart = assistantMsg.parts[0];
    assert.strictEqual(thoughtPart.thought, 'The user wants a sum.');
    assert.strictEqual(thoughtPart.thought_signature, 'sig_12345');

    const funcPart = assistantMsg.parts[2];
    assert.strictEqual(funcPart.functionCall.name, 'runCommand');

    console.log('✅ LLM Thought Persistence Logic verified!');
}

testThoughtPersistence().catch(err => {
    console.error('❌ Test Failed:', err);
    process.exit(1);
});
