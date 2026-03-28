const LLMService = require('./core/llm.js');

async function test_mission() {
    const llm = new LLMService('gemini-2.0-flash-exp');
    console.log("Starting mission simulation...");
    const messages = [
        { role: 'user', content: `
Mission: Build NexusOS Client Landing Page

I need you to build a high-converting landing page to sell NexusOS as an autonomous AI agency service to potential clients.

Instructions for the mission:

Use the searchWeb tool to find the latest trends in "AI automation agency landing pages" or "Autonomous AI agent services" to get structural ideas.
Propose the exact HTML/CSS and copywriting structure for the landing page. Focus on a dark, premium, futuristic theme that screams "Advanced Intelligence."
Create the necessary files (e.g., index.html, style.css) in a new folder called nexus-landing-page using the runCommand and writeFile tools.
Use the generateImage tool to create at least 2 stunning visual assets for the site (e.g., a glowing digital brain or a futuristic dashboard) and save them to the same folder.
Make sure you use your new Reasoning Transparency to explain why you are making these design choices as you build it.
Start by outlining the wireframe and copy!
` }
    ];
    
    try {
        const result = await llm.generateResponse(messages, { mode: 'execute' });
        console.log("SUCCESS:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("ERROR:", e);
    }
}

test_mission();
