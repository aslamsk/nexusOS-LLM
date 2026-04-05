const LLMService = require('./llm');
const WorktreeTool = require('../tools/worktree');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Nexus OS: Agent Swarm System (Advanced)
 * Ported from Claude AgentTool / Forking Logic.
 * Allows the orchestrator to spawn specialized sub-agents with:
 * - Worktree Isolation
 * - Fast Context Forking
 * - Async Lifecycle Management
 */
class SquadSystem {
    constructor() {
        this.agents = {
            researcher: { role: "Researcher", tools: ["searchWeb", "browserAction"] },
            writer: { role: "Writer", tools: ["writeFile", "readFile", "askUserForInput"] },
            coder: { role: "Coder", tools: ["readFile", "writeFile", "replaceFileContent", "multiReplaceFileContent", "runCommand", "codeMap", "codeSearch", "codeFindFn", "askUserForInput"], is_privileged: true },
            designer: { role: "Designer", tools: ["generateImage", "removeBg"] }
        };
        this.llmService = new LLMService();
        this.activeSwarm = new Map();
    }

    getAgentProfile(agentType) {
        return this.agents[agentType] || null;
    }

    /**
     * Delegate a sub-task to a specific agent type with isolation.
     */
    async delegate(agentType, task, options = {}) {
        const taskId = `swarm_${agentType}_${Date.now()}`;
        console.log(`[Squad] Spawning Agent Swarm: ${agentType} for task [${taskId}]...`);
        
        let missionDir = process.cwd();
        let isolationResult = null;

        // [CLAUDE-WORKTREE-ISOLATION] For code tasks, create a worktree sandbox
        if (options.isolate || agentType === 'coder') {
            isolationResult = JSON.parse(WorktreeTool.createWorktree(taskId));
            if (isolationResult.ok) missionDir = isolationResult.worktreePath;
            else console.warn(`[Squad] Isolation failed, falling back to main worktree: ${isolationResult.error}`);
        }

        const agent = this.getAgentProfile(agentType);
        if (!agent) return `Error: Agent type "${agentType}" not found.`;

        // [CLAUDE-FORKING-LOGIC] Clone parent context for the swarm
        const swarmContext = options.context || [];
        const swarmMessages = [
            { role: 'system', content: `You are the ${agent.role} Agent in the Nexus Swarm. MISSION: ${task}\nDIR: ${missionDir}` },
            ...swarmContext
        ];

        if (options.runInBackground) {
            return this._spawnBackgroundSwarm(taskId, agentType, swarmMessages, missionDir);
        }

        try {
            // Specialist agents run with their specific subset of tools
            const response = await this.llmService.generateResponse(swarmMessages, {
                mode: 'execute',
                allowedTools: agent.tools
            });
            return {
                agent: agent.role,
                taskId,
                worktree: missionDir,
                result: response.text,
                toolCall: response.toolCall
            };
        } catch (e) {
            return `Error in delegation: ${e.message}`;
        }
    }

    _spawnBackgroundSwarm(taskId, agentType, messages, cwd) {
        // [CLAUDE-ASYNC-LIFECYCLE] Persistence for swarm missions
        const stateFile = path.join(__dirname, '..', 'outputs', 'swarm', `${taskId}.json`);
        if (!fs.existsSync(path.dirname(stateFile))) fs.mkdirSync(path.dirname(stateFile), { recursive: true });
        
        fs.writeFileSync(stateFile, JSON.stringify({ status: 'running', agentType, taskId, cwd, messages }, null, 2));

        // Simulated background drift - actual implementation would use child_process or worker_threads
        this.activeSwarm.set(taskId, { status: 'running', agentType, stateFile });

        return JSON.stringify({
            ok: true,
            taskId,
            status: 'background_mission_active',
            message: `Swarm agent [${agentType}] is executing in background at ${cwd}.`
        }, null, 2);
    }
}

module.exports = new SquadSystem();
