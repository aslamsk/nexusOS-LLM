const LLMService = require('../core/llm');
const ConfigService = require('../core/config');

async function debugGemini() {
    const llm = new LLMService();
    const prompt = "open https://teluguloislamahamed.com/playquiz/2026-03-23 if any details asked enter name : Shafi, Mobile: 8885202721, City: Ongole, submit and quiz will be opened read all questions 1 by 1 and give correct answers and submit do not close it";
    
    console.log('--- Calling Gemini 3.1 ---');
    const result = await llm.generateResponse([{ role: 'user', content: prompt }]);
    
    console.log('--- Result Object ---');
    console.log(JSON.stringify(result, null, 2));

    process.exit(0);
}

debugGemini().catch(err => {
    console.error(err);
    process.exit(1);
});
