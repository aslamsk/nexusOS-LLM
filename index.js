const fs = require('fs');
const path = require('path');
const FileSystemTool = require('./tools/fileSystem');
const TerminalTool = require('./tools/terminal');
const BrowserTool = require('./tools/browser');
const ImageGenTool = require('./tools/imageGen');
const N8nDiscoverTool = require('./tools/n8nDiscover');
const MetaAdsTool = require('./tools/metaAds');
const LLMService = require('./core/llm');
const VideoGenTool = require('./tools/videoGen');
const JarvisOrchestrator = require('./core/jarvis/orchestrator');
const AgentManager = require('./core/jarvis/agentManager');
const DataService = require('./core/jarvis/dataService');
const MediaService = require('./core/jarvis/mediaService');
const ExecutionEngine = require('./core/jarvis/executionEngine');

/**
 * Nexus OS Orchestrator
 * The brain of the operation.
 */
class NexusOrchestrator {
    constructor(onUpdate = null, taskDir = null) {
        this.systemPrompt = fs.readFileSync(path.join(__dirname, 'core', 'system_prompt.md'), 'utf8');
        this.context = [{ role: 'system', content: this.systemPrompt }];
        this.onUpdate = onUpdate || ((event) => console.log(`[${event.type.toUpperCase()}]`, event.message || event.args || ''));
        this.taskDir = taskDir || path.join(__dirname, 'outputs');
        
        this.llmService = new LLMService();
        this.db = new DataService(path.join(__dirname, 'data'));
        this.media = new MediaService(this.taskDir);
        
        this.tools = {
            readFile: FileSystemTool.readFile,
            writeFile: FileSystemTool.writeFile,
            listDir: FileSystemTool.listDir,
            runCommand: TerminalTool.runCommand,
            browserAction: BrowserTool.executeAction.bind(BrowserTool),
            generateImage: ImageGenTool.generateImage.bind(ImageGenTool),
            n8nSearch: N8nDiscoverTool.searchWorkflows.bind(N8nDiscoverTool),
            getN8nWorkflow: N8nDiscoverTool.getWorkflow.bind(N8nDiscoverTool),
            metaAds: MetaAdsTool
        };

        this.jarvis = new JarvisOrchestrator(this.llmService);
        this.agentManager = new AgentManager(this.llmService);
        this.engine = new ExecutionEngine(this.llmService, this.db, this.media, this);
        
        this.maxSteps = 15;
    }

    /**
     * The main execution loop.
     */
    async execute(userRequest) {
        this.onUpdate({ type: 'start', message: `Starting task: ${userRequest}` });

        // Inject the active working directory into the prompt if specified
        let augmentedRequest = userRequest;
        if (this.taskDir) {
            const folderName = path.basename(this.taskDir);
            augmentedRequest += `\n\nIMPORTANT SYSTEM DIRECTIVE: You MUST save any and all generated files, images, or code for this specific task into the following absolute directory path ONLY: ${this.taskDir}. Do not save files to the root directory. Whenever you create a file, you MUST give the user a download link in your final message using this exact markdown format: [Download filename.ext](/outputs/${folderName}/filename.ext)`;
        }

        this.context.push({ role: 'user', content: augmentedRequest });

        for (let step = 0; step < this.maxSteps; step++) {
            this.onUpdate({ type: 'step', message: `--- Step ${step + 1} ---` });

            // Ask LLM what to do next
            const response = await this.llmService.generateResponse(this.context);

            if (response.text) {
                this.onUpdate({ 
                    type: 'thought', 
                    agentId: 'Nexus',
                    status: 'thinking',
                    message: response.text 
                });
                this.context.push({ role: 'assistant', content: response.text });
            }

            if (response.toolCall) {
                this.onUpdate({
                    type: 'action',
                    agentId: 'Nexus',
                    status: 'working',
                    name: response.toolCall.name,
                    args: response.toolCall.args
                });

                // Keep history updated with the call
                this.context.push({
                    role: 'assistant',
                    content: '',
                    toolCall: response.toolCall
                });

                // Execute the tool
                const result = await this.dispatchTool(response.toolCall);
                const resultString = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
                const truncatedResult = resultString.length > 1000 ? resultString.substring(0, 1000) + '...' : resultString;

                this.onUpdate({ 
                    type: 'result', 
                    agentId: 'Nexus',
                    status: 'idle',
                    message: truncatedResult 
                });

                // Add result back to context
                this.context.push({ role: 'tool', name: response.toolCall.name, content: resultString });
            } else {
                this.onUpdate({ type: 'complete', message: 'Task Complete. No further actions requested.' });
                break;
            }
        }

        // Conditionally close browser
        const shouldClose = /auto[- ]?close(d)?/i.test(userRequest);
        if (shouldClose) {
            this.onUpdate({ type: 'step', message: 'Auto-closing browser as requested...' });
            await BrowserTool.close();
        }
    }

    async dispatchTool(toolCall) {
        const { name, args } = toolCall;
        try {
            switch (name) {
                case 'readFile': return await this.tools.readFile(args.absolutePath);
                case 'writeFile': return await this.tools.writeFile(args.absolutePath, args.content);
                case 'listDir': return await this.tools.listDir(args.absolutePath);
                case 'runCommand': return await this.tools.runCommand(args.command, args.cwd);
                case 'browserAction': return await this.tools.browserAction(args);
                case 'generateImage': return await this.tools.generateImage(args.prompt, args.savePath);
                case 'n8nSearch': return await this.tools.n8nSearch(args.query);
                case 'getN8nWorkflow': return await this.tools.getN8nWorkflow(args.path);
                case 'metaCreateCampaign': return await this.tools.metaAds.createCampaign(args.name, args.objective);
                case 'metaCreateAdSet': 
                    return await this.tools.metaAds.createAdSet(
                        args.campaignId, 
                        args.name, 
                        args.budget || args.dailyBudget || 1000, 
                        args.targeting
                    );
                case 'metaCreateCreative': 
                    return await this.tools.metaAds.createAdCreative(
                        args.name, 
                        args.title, 
                        args.body, 
                        args.imageHash || args.imageUrl, 
                        args.pageId,
                        args.cta || 'SHOP_NOW'
                    );
                case 'metaCreateAd': return await this.tools.metaAds.createAd(args.adSetId, args.creativeId, args.name);
                case 'metaPublishOrganicPost': return await this.tools.metaAds.publishPagePost(args.pageId, args.message, args.link);
                case 'metaPublishOrganicPhoto': return await this.tools.metaAds.publishPagePhoto(args.pageId, args.message, args.imagePath);
                case 'metaPublishOrganicVideo': return await this.tools.metaAds.publishPageVideo(args.pageId, args.title, args.description, args.videoPath);
                case 'metaPublishOrganicReel': return await this.tools.metaAds.publishPageReel(args.pageId, args.description, args.videoPath);
                case 'metaGetPageInsights': return await this.tools.metaAds.getPageInsights(args.pageId);
                case 'metaGetAccountInfo': return await this.tools.metaAds.getAccountInfo();
                case 'metaUploadImage': return await this.tools.metaAds.uploadImage(args.imagePath);
                case 'generateVideo': return await VideoGenTool.imageToVideo(args.imagePath, args.outputPath);
                case 'metaGetComments': return await this.tools.metaAds.getComments(args.objectId);
                case 'metaReplyToComment': return await this.tools.metaAds.replyToComment(args.commentId, args.message);
                case 'jarvisExecute': {
                    this.onUpdate({ type: 'thought', message: `Brain: Planning project for goal: ${args.goal}` });
                    const plan = await this.jarvis.generatePlan(args.goal);
                    
                    const project = await this.db.createProject(plan.projectTitle, args.goal);
                    let projectResults = `🎯 **Project: ${project.name}**\n\n`;
                    
                    // Initial task creation
                    for (const t of plan.tasks) {
                        await this.db.createTask(project.id, t.role, t.title, t.description);
                    }

                    // Dynamic Execution Queue: Process tasks until all are finished
                    let processedTaskIds = new Set();
                    let hasUnfinishedTasks = true;

                    while (hasUnfinishedTasks) {
                        const allProjectTasks = await this.db.getTasks(project.id);
                        const nextTask = allProjectTasks.find(t => t.status === 'pending' && !processedTaskIds.has(t.id));

                        if (!nextTask) {
                            hasUnfinishedTasks = false;
                            break;
                        }

                        this.onUpdate({ type: 'thought', message: `Agent assigned: ${nextTask.role} for ${nextTask.title}` });
                        processedTaskIds.add(nextTask.id);

                        // Sync delay
                        await new Promise(r => setTimeout(r, 200));

                        try {
                            const artifact = await this.engine.executeTask(nextTask.id);
                            projectResults += `✅ **[${nextTask.role}] ${nextTask.title}**: Task completed. Artifact generated.\n\n`;
                        } catch (err) {
                            console.error(`[Orchestrator] Task ${nextTask.id} failed:`, err);
                            projectResults += `❌ **[${nextTask.role}] ${nextTask.title}**: Failed - ${err.message}\n\n`;
                        }
                    }
                    
                    return projectResults + `\n\n**Strategic Conclusion**: All agents have finished their assignments. View the full results on your [Strategic Dashboard](http://localhost:3000/dashboard.html).`;
                }
                default: return `Error: Tool ${name} not found.`;
            }
        } catch (error) {
            return `Error executing tool: ${error.message}`;
        }
    }
}

// Entry point
if (require.main === module) {
    const orchestrator = new NexusOrchestrator();
    const request = process.argv.slice(2).join(' ') || "What time is it right now? Use the terminal to find out.";
    orchestrator.execute(request).catch(console.error);
}

module.exports = NexusOrchestrator;
