const LLMService = require('./llm');

/**
 * Nexus OS: Multi-Agent Squad System
 * Allows the orchestrator to spawn specialized sub-agents for focused tasks.
 */
class SquadSystem {
    constructor() {
        this.agents = {
            researcher: {
                role: "Researcher",
                description: "Deep research, web searching, and data gathering.",
                systemPrompt: "You are the Squad's Researcher. Use searchWeb and browserAction to gather deep info.",
                tools: ["searchWeb", "browserAction"]
            },
            writer: {
                role: "Writer",
                description: "Copywriting, blog posts, ad scripts, and reporting.",
                systemPrompt: "You are the Squad's Writer. Create high-fidelity, premium copy.",
                tools: ["writeFile", "readFile", "openRouterChat"]
            },
            coder: {
                role: "Coder",
                description: "Writing code, debugging, and project structure.",
                systemPrompt: "You are the Squad's Senior Software Engineer. Build functional perfection.",
                tools: ["readFile", "writeFile", "runCommand", "codeMap", "codeSearch", "codeFindFn"]
            },
            designer: {
                role: "Designer",
                description: "Generating images, removing backgrounds, and UI layout.",
                systemPrompt: "You are the Squad's Designer. Create visual excellence.",
                tools: ["generateImage", "removeBg"]
            },
            ads_manager: {
                role: "Ads Manager",
                description: "Managing Meta, Google, and LinkedIn ad campaigns.",
                systemPrompt: "You are the Squad's Performance Marketer. Optimize for results.",
                tools: ["metaAds", "googleAdsListCampaigns", "linkedinPublishPost"]
            }
        };
        this.llmService = new LLMService();
    }

    /**
     * Delegate a sub-task to a specific agent type.
     */
    async delegate(agentType, task, context = []) {
        console.log(`[Squad] Delegating task to ${agentType}: "${task.substring(0, 50)}..."`);
        const agent = this.agents[agentType];
        if (!agent) return `Error: Agent type "${agentType}" not found.`;

        const agentMessages = [
            { role: 'system', content: agent.systemPrompt },
            ...context,
            { role: 'user', content: `YOUR MISSION: ${task}` }
        ];

        try {
            // Specialist agents run with their specific subset of tools
            // For now, they return a structured thought/response to the Boss
            const response = await this.llmService.generateResponse(agentMessages);
            return {
                agent: agent.role,
                result: response.text,
                toolCall: response.toolCall // If they need the Boss to run a tool
            };
        } catch (e) {
            return `Error in delegation: ${e.message}`;
        }
    }
}

module.exports = new SquadSystem();
