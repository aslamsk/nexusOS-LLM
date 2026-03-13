const RoleRegistry = require('./roleRegistry');

/**
 * Nexus-Jarvis Orchestrator
 * 
 * Translates high-level goals into multi-agent task groups.
 */
class JarvisOrchestrator {
    constructor(llmService) {
        this.llm = llmService;
    }

    /**
     * Generate a structured plan for a global goal.
     */
    async generatePlan(goal) {
        console.log(`[JarvisOrchestrator] Planning for: "${goal}"`);

        const roles = RoleRegistry.getRoles();
        const expertsList = roles.map(r => `- Role: "${r}"`).join('\n');

        const prompt = `
        You are the Master Orchestrator for Nexus OS, acting as the Executive Project Lead.
        You must implement a strict hierarchy: BOSS (User) -> PROJECT MANAGER (PM) -> SPECIALIZED AGENTS.

        Goal: ${goal}

        1. HIERARCHICAL STRUCTURE:
           - Every plan MUST start with a **Manager** task. For complex builds, this is "Project Initiation & Strategic Planning".
           - If the goal is a direct OS action (e.g., "open D drive", "check disk space"), the Manager can fulfill it directly using their tools.
           - The Manager identifies if an **Architect** or **Fullstack Developer** is needed for specialist work.
           - The Manager always provides the final consolidated report to the Boss.

        2. EXPERT ROLES (Super Senior Level):
${expertsList}

        3. DYNAMIC CATEGORIZATION:
           - **Pure Asset**: (Logo, Banner). Assign: Manager -> Designer.
           - **Technical Build**: (Web App, API). Assign: Manager -> Architect -> Fullstack_Developer.
           - **Strategic Research**: Assign: Manager -> Atlas.

        Return a JSON structure:
        {
            "projectTitle": "Short catchy name",
            "tasks": [
                { "role": "manager", "title": "Project Initiation & Strategic Planning", "description": "Define the full scope and delegate to specialists." }
                // Manager will then spawn subtasks via ExecutionEngine.
            ]
        }
        `;

        try {
            const messages = [
                { role: 'system', content: 'You are the Master Orchestrator for Nexus OS. Respond ONLY with valid JSON.' },
                { role: 'user', content: prompt }
            ];
            const response = await this.llm.generateResponse(messages);
            const rawText = response.text || '';
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No valid JSON found in planner response");
            
            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error("[JarvisOrchestrator] Planning failed:", error);
            return {
                projectTitle: "Fallback Task",
                tasks: [{ role: "manager", title: "Direct Execution", description: goal }]
            };
        }
    }
}

module.exports = JarvisOrchestrator;
