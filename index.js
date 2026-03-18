const fs = require('fs');
const path = require('path');
const FileSystemTool = require('./tools/fileSystem');
const TerminalTool = require('./tools/terminal');
const BrowserTool = require('./tools/browser');
const ImageGenTool = require('./tools/imageGen');
const N8nDiscoverTool = require('./tools/n8nDiscover');
const MetaAdsTool = require('./tools/metaAds');
const GoogleAdsTool = require('./tools/googleAds');
const LinkedInAdsTool = require('./tools/linkedinAds');
const VideoGenTool = require('./tools/videoGen');
const BackgroundRemovalTool = require('./tools/backgroundRemoval');
const OpenRouterTool = require('./tools/openRouter');
const LLMService = require('./core/llm');

/**
 * Nexus OS Orchestrator
 * The brain of the operation.
 */
class NexusOrchestrator {
    constructor(onUpdate = null, taskDir = null) {
        this.systemPrompt = fs.readFileSync(path.join(__dirname, 'core', 'system_prompt.md'), 'utf8');
        this.context = [{ role: 'system', content: this.systemPrompt }];
        this.tools = {
            readFile: FileSystemTool.readFile,
            writeFile: FileSystemTool.writeFile,
            listDir: FileSystemTool.listDir,
            replaceFileContent: FileSystemTool.replaceFileContent,
            multiReplaceFileContent: FileSystemTool.multiReplaceFileContent,
            runCommand: TerminalTool.runCommand,
            browserAction: BrowserTool.executeAction.bind(BrowserTool),
            generateImage: ImageGenTool.generateImage.bind(ImageGenTool),
            n8nSearch: N8nDiscoverTool.searchWorkflows.bind(N8nDiscoverTool),
            getN8nWorkflow: N8nDiscoverTool.getWorkflow.bind(N8nDiscoverTool),
            removeBg: BackgroundRemovalTool.removeBg.bind(BackgroundRemovalTool),
            metaAds: MetaAdsTool,
            googleAds: GoogleAdsTool,
            linkedinAds: LinkedInAdsTool,
            openRouter: OpenRouterTool
        };
        this.llmService = new LLMService();
        this.maxSteps = 40;
        this.taskDir = taskDir;
        // Callback to emit events to the frontend
        this.onUpdate = onUpdate || ((event) => console.log(`[${event.type.toUpperCase()}]`, event.message || event.args || ''));
        this.lastUploadedFile = null;
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

        // Detect uploaded file paths in the request to maintain state
        const filePathMatch = augmentedRequest.match(/Path: `([^`]+)`/);
        if (filePathMatch) {
            this.lastUploadedFile = filePathMatch[1];
        }

        this.context.push({ role: 'user', content: augmentedRequest });
        this.stepCount = 0;

        await this._runLoop(userRequest);
    }

    async resume(userInput) {
        this.onUpdate({ type: 'start', message: `Resuming task with user input...` });
        
        const lastMsg = this.context[this.context.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.toolCall && lastMsg.toolCall.name === 'askUserForInput') {
             this.context.push({ role: 'tool', name: 'askUserForInput', content: userInput });
        } else {
             this.context.push({ role: 'user', content: userInput });
        }

        await this._runLoop(null);
    }

    async _runLoop(originalRequest) {
        for (; this.stepCount < this.maxSteps; this.stepCount++) {
            this.onUpdate({ type: 'step', message: `--- Step ${this.stepCount + 1} ---` });

            // Inject stateful tracking context (Dynamic System Update)
            if (this.lastUploadedFile) {
                const stateContext = `[CURRENT_SYSTEM_STATE] Active File Context: "${this.lastUploadedFile}". If a user says "improve this", "run this", "change this", or "promote this", ALWAYS assume they mean this file.`;
                // We prepend/update a system message about state
                const systemIdx = this.context.findIndex(m => m.role === 'system');
                if (systemIdx !== -1) {
                    this.context[systemIdx].content = this.systemPrompt + "\n\n" + stateContext;
                }
            }

            // Ask LLM what to do next
            const response = await this.llmService.generateResponse(this.context);

            if (response.text) {
                this.onUpdate({ type: 'thought', message: response.text });
                this.context.push({ role: 'assistant', content: response.text });
            }

            if (response.toolCall) {
                this.onUpdate({
                    type: 'action',
                    name: response.toolCall.name,
                    args: response.toolCall.args
                });

                // Keep history updated with the call
                this.context.push({
                    role: 'assistant',
                    content: '',
                    toolCall: response.toolCall
                });

                if (response.toolCall.name === 'askUserForInput') {
                    this.onUpdate({ type: 'input_requested', message: response.toolCall.args.question });
                    return; // Pause execution
                }

                // Execute the tool
                const result = await this.dispatchTool(response.toolCall);
                const resultString = String(result);

                // PROACTIVE FEEDBACK: If tool result is an error, broadcast it as a thought immediately
                if (resultString.toLowerCase().includes('error') || resultString.toLowerCase().includes('missing')) {
                    this.onUpdate({ type: 'thought', message: `🔍 Workflow Insight: ${resultString}` });
                }

                const truncatedResult = resultString.length > 5000 ? resultString.substring(0, 5000) + '...' : resultString;

                this.onUpdate({ type: 'result', message: truncatedResult });

                // Add result back to context
                this.context.push({ role: 'tool', name: response.toolCall.name, content: result });
            } else {
                this.onUpdate({ type: 'complete', message: 'Task Complete. No further actions requested.' });
                break;
            }
        }

        // Conditionally close browser
        const requestToCheck = originalRequest || (this.context.find(m => m.role === 'user')?.content || "");
        const shouldClose = /auto[- ]?close(d)?/i.test(requestToCheck);
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
                case 'replaceFileContent': 
                    return await this.tools.replaceFileContent(args.absolutePath, args.startLine, args.endLine, args.targetContent, args.replacementContent);
                case 'multiReplaceFileContent':
                    return await this.tools.multiReplaceFileContent(args.absolutePath, args.chunks);
                case 'runCommand': return await this.tools.runCommand(args.command, args.cwd);
                case 'browserAction': return await this.tools.browserAction(args);
                case 'generateImage': return await ImageGenTool.generateImage(args.prompt, args.savePath);
                case 'improveImage': return await ImageGenTool.improveImage(args.prompt, args.imagePath, args.savePath);
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
                case 'generateVideo': 
                    if (args.prompt) {
                        // 1. Attempt High-Fidelity Google Veo (Ad Quality)
                        const veoResult = await VideoGenTool.generateWithVeo(args.prompt, args.outputPath, args.imagePath);
                        if (!veoResult.error) return `SUCCESS: Ad-quality Veo created at ${args.outputPath}`;
                        
                        // 2. Fallback to Replicate if Veo fails and token exists
                        if (process.env.REPLICATE_API_TOKEN) {
                            const repResult = await VideoGenTool.generateFromPrompt(args.prompt, args.outputPath);
                            if (!repResult.error) return `SUCCESS: Generative Video created at ${args.outputPath}`;
                        }

                        // 3. Last fallback: Gemini Image + Manual FFmpeg (Free Mode)
                        const freeResult = await VideoGenTool.generateFromPromptFree(args.prompt, args.outputPath);
                        return freeResult.error ? `Error: ${freeResult.error}` : `SUCCESS: Free Video created at ${args.outputPath}`;
                    }
                    const localResult = await VideoGenTool.imageToVideo(args.imagePath, args.outputPath);
                    return localResult.error ? `Error: ${localResult.error}` : `SUCCESS: Video created at ${args.outputPath}`;
                case 'removeBg': return await this.tools.removeBg(args.inputPath, args.outputPath);
                case 'googleAdsListCampaigns': return await this.tools.googleAds.listCampaigns(args.customerId);
                case 'googleAdsCreateCampaign': return await this.tools.googleAds.createCampaign(args.customerId, args.campaignData);
                case 'linkedinPublishPost': return await this.tools.linkedinAds.publishOrganicPost(args.urn, args.text);
                case 'metaGetComments': return await this.tools.metaAds.getComments(args.objectId);
                case 'metaSetCredentials': return await this.tools.metaAds.setCredentials(args.accessToken, args.adAccountId, args.pageId);
                case 'metaReplyToComment': return await this.tools.metaAds.replyToComment(args.commentId, args.message);
                case 'openRouterChat': return await this.tools.openRouter.chat(args.prompt, args.model);
                default: return `Error: Tool ${name} not found.`;
            }
        } catch (error) {
            return `Error executing tool: ${error.message}`;
        }
    }

    /**
     * Gets the current serializable state for persistence.
     */
    getPersistentState() {
        return {
            context: this.context,
            lastUploadedFile: this.lastUploadedFile,
            stepCount: this.stepCount
        };
    }

    /**
     * Loads a previously saved state.
     */
    restorePersistentState(state) {
        if (!state) return;
        if (state.context) this.context = state.context;
        if (state.lastUploadedFile) this.lastUploadedFile = state.lastUploadedFile;
        if (state.stepCount !== undefined) this.stepCount = state.stepCount;
    }
}

// Entry point
if (require.main === module) {
    const orchestrator = new NexusOrchestrator();
    const request = process.argv.slice(2).join(' ') || "What time is it right now? Use the terminal to find out.";
    orchestrator.execute(request).catch(console.error);
}

module.exports = NexusOrchestrator;
