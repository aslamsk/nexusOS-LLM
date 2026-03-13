const RoleRegistry = require('./roleRegistry');

/**
 * Nexus Execution Engine
 * 
 * The "Heart" of the Agency. Executes tasks, sniffs artifacts, and spawns subtasks.
 */
class ExecutionEngine {
    constructor(llm, dataService, mediaService, tools) {
        this.llm = llm;
        this.db = dataService;
        this.media = mediaService;
        this.tools = tools; // This is the NexusOrchestrator instance
    }

    async executeTask(taskId) {
        console.log(`[ExecutionEngine] Executing task: ${taskId}`);
        
        let task;
        for (let i = 0; i < 3; i++) {
            const tasks = await this.db.getTasks();
            task = tasks.find(t => t.id === taskId);
            if (task) break;
            await new Promise(r => setTimeout(r, 500));
        }

        if (!task) throw new Error("Task not found");

        await this.db.updateTaskStatus(taskId, 'running');

        // Filter out orchestration tools (like jarvisExecute) from the agents' context
        const toolDefinitions = this.llm.getToolDefinitions().filter(d => d.name !== 'jarvisExecute');
        const toolNames = toolDefinitions.map(d => `- **${d.name}**: ${d.description}`).join('\n');

        const messages = [
            { 
                role: 'system', 
                content: `${RoleRegistry.getPromptForRole(task.role)}
                
                AVAILABLE TOOLS FOR OS INTERACTION:
                ${toolNames}
                
                You have primary authority to use these tools to fulfill the mission. If you need to access files, drives, run commands, or browse the web, execute the appropriate tool call immediately.
                ` 
            },
            { role: 'user', content: `Current Mission: ${task.title}\nDetails: ${task.description}\n\nProceed with the execution.` }
        ];

        let artifact = null;

        try {
            // Execution Loop: Allow agent to call tools multiple times
            for (let step = 0; step < 5; step++) {
                const response = await this.llm.generateResponse(messages);
                
                if (response.toolCall) {
                    this.tools.onUpdate({
                        type: 'action',
                        agentId: task.role,
                        status: 'working',
                        name: response.toolCall.name,
                        args: response.toolCall.args
                    });

                    // Add the call to history
                    messages.push({ role: 'assistant', content: response.text || '', toolCall: response.toolCall });

                    // Execute tool via Orchestrator
                    const result = await this.tools.dispatchTool(response.toolCall);
                    const resultString = typeof result === 'object' ? JSON.stringify(result) : String(result);

                    // Add result back to history
                    messages.push({ role: 'tool', name: response.toolCall.name, content: resultString });
                    
                    this.tools.onUpdate({
                        type: 'thought',
                        agentId: task.role,
                        status: 'thinking',
                        message: `Processed ${response.toolCall.name}. Continuing...`
                    });
                    
                    continue; // Next iteration to see if it needs more tools
                }

                // If no tool call, it's the final response
                const rawResponse = response.text || '';
                let result = { artifactContent: rawResponse, artifactType: 'document', agent_message: 'Task completed.' };
                const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        result = JSON.parse(jsonMatch[0]);
                    } catch (e) {}
                }

                let artifactType = result.artifactType || 'document';
                const content = result.artifactContent || '';
                const isHtml = content.includes('<html') || (content.includes('<body') && content.includes('</div>'));
                if (isHtml && artifactType !== 'code') artifactType = 'code';

                let finalContent = content;
                if (isHtml && !content.includes('<!DOCTYPE html>')) {
                    finalContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap'); body { font-family: 'Inter', sans-serif; padding: 40px; }</style></head><body>${content}</body></html>`;
                }

                artifact = await this.db.createArtifact(task.projectId, task.id, `Output: ${task.title}`, finalContent, artifactType);

                // Handle subtasks
                if (result.follow_up_tasks && Array.isArray(result.follow_up_tasks)) {
                    for (const subtask of result.follow_up_tasks) {
                        await this.db.createTask(task.projectId, subtask.role, subtask.title, subtask.description);
                    }
                }

                break; // Exit loop after final response
            }

            const isManager = task.role.toLowerCase().includes('manager');
            await this.db.updateTaskStatus(taskId, 'waiting_approval');
            
            this.tools.onUpdate({
                type: 'result',
                agentId: task.role,
                status: 'idle',
                message: isManager 
                    ? `[PM -> BOSS] Work package ready for sign-off: "${task.title}".`
                    : `[${task.role} -> PM] Task "${task.title}" ready.`
            });

            return artifact;

        } catch (error) {
            console.error("[ExecutionEngine] Task failed:", error);
            await this.db.updateTaskStatus(taskId, 'failed');
            throw error;
        }
    }
}

module.exports = ExecutionEngine;
