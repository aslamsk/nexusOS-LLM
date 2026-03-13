const RoleRegistry = require('./roleRegistry');

/**
 * Nexus-Jarvis Agent Manager
 * 
 * Executes a single task using a specific role's personality and tools.
 */
class AgentManager {
    constructor(llmService) {
        this.llm = llmService;
    }

    /**
     * Execute a specific task using a role.
     */
    async executeTask(role, taskTitle, taskDescription, contextAdviser = '') {
        console.log(`[AgentManager] ${role} starting task: "${taskTitle}"`);
        
        const systemPrompt = RoleRegistry.getPromptForRole(role, contextAdviser);
        const userPrompt = `
        Task: ${taskTitle}
        Description: ${taskDescription}
        
        Execute this task with elite precision. If tools are needed, list them.
        `;

        try {
            const response = await this.llm.generateResponse(userPrompt, systemPrompt);
            return response;
        } catch (error) {
            console.error(`[AgentManager] ${role} execution failed:`, error);
            return `Error in agent execution: ${error.message}`;
        }
    }
}

module.exports = AgentManager;
