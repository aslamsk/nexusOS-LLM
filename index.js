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
const BackgroundRemovalTool = require('./tools/backgroundRemoval');
const OpenRouterTool = require('./tools/openRouter');
const VideoGenTool = require('./tools/videoGen');
const SearchTool = require('./tools/search');
const CodeAwarenessTool = require('./tools/codeAwareness');
const EmailTool = require('./tools/email');
const WhatsAppTool = require('./tools/whatsapp');
const MemoryService = require('./core/memory');
const SquadSystem = require('./core/squad');
const LLMService = require('./core/llm');
const GovernanceService = require('./core/governance');
const SelfHealingService = require('./core/selfHealing');

/**
 * Nexus OS Orchestrator
 * The brain of the operation.
 */
class NexusOrchestrator {
    constructor(onUpdate = null, taskDir = null) {
        this._systemPromptPath = path.join(__dirname, 'core', 'system_prompt.md');
        // Dynamic system prompt: read fresh from disk every task so changes take effect without restart
        Object.defineProperty(this, 'systemPrompt', {
            get: () => fs.readFileSync(this._systemPromptPath, 'utf8'),
            enumerable: true
        });
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
            openRouter: OpenRouterTool,
            searchWeb: SearchTool.search.bind(SearchTool),
            codeMap: CodeAwarenessTool.mapCodebase.bind(CodeAwarenessTool),
            codeSearch: CodeAwarenessTool.searchInCode.bind(CodeAwarenessTool),
            codeFindFn: CodeAwarenessTool.findFunction.bind(CodeAwarenessTool),
            sendEmail: EmailTool.sendEmail.bind(EmailTool),
            readEmail: EmailTool.readInbox.bind(EmailTool),
            sendWhatsApp: WhatsAppTool.sendMessage.bind(WhatsAppTool),
            sendWhatsAppMedia: WhatsAppTool.sendMedia.bind(WhatsAppTool),
            saveMemory: MemoryService.saveMemory.bind(MemoryService),
            searchMemory: MemoryService.searchMemory.bind(MemoryService),
            delegateToAgent: SquadSystem.delegate.bind(SquadSystem)
        };
        this.llmService = new LLMService();
        this.maxSteps = 40;
        this.taskDir = taskDir;
        // Callback to emit events to the frontend
        this.onUpdate = onUpdate || ((event) => console.log(`[${event.type.toUpperCase()}]`, event.message || event.args || ''));
        this.lastUploadedFile = null;
        this.isRunning = false;
        this.stepCount = 0;
        this.currentClientId = null;
        this.isWaitingForInput = false;
        this.currentRun = null;
        this.recentRuns = [];
        this.pendingApproval = null;
        this.auditTrail = [];
        this.pendingRepair = null;
        this.recoveryHistory = [];
    }

    /**
     * Set the current client context, enforcing robust memory isolation
     * and ensuring tool keys map exclusively to the active entity.
     */
    setClientContext(clientId, clientConfig) {
        const ConfigService = require('./core/config');
        ConfigService.setClientOverrides(clientConfig);

        if (this.currentClientId !== clientId) {
            this.currentClientId = clientId;
            // Absolute memory isolation: Reset context entirely when swapping entities
            this.context = [{ role: 'system', content: this.systemPrompt }];
            if (clientId) {
                this.onUpdate({ type: 'thought', message: `🔄 Context Protocol: Initialized isolated execution enclave for Client [${clientId}].` });
            } else {
                this.onUpdate({ type: 'thought', message: `🔄 Context Protocol: Reverting to Default System Context.` });
            }
        }
    }

    /**
     * The main execution loop.
     */
    async execute(userRequest) {
        this.isRunning = true;
        this.isStopped = false;
        this.isWaitingForInput = false;
        this._beginRun(userRequest);

        // CRITICAL FIX: Reset context for a fresh mission to prevent "stale failure" baggage.
        // This ensures the AI starts with a clean slate (System Prompt + New Request).
        this.context = [{ role: 'system', content: this.systemPrompt }];
        // Recall Long-Term Memories
        const memories = await MemoryService.recallRecent(5);
        const recoveryPatterns = await MemoryService.findRecoveryPatterns(userRequest, 3);
        let memoryPrompt = "";
        if (memories.length > 0) {
            memoryPrompt = `\n\n### LONG-TERM MEMORY RECALL:\n${memories.map(m => `- ${m}`).join('\n')}\n\n`;
        }
        if (recoveryPatterns.length > 0) {
            memoryPrompt += `### RECOVERY PATTERN RECALL:\n${recoveryPatterns.map((p, idx) => `${idx + 1}. Tool: ${p.tool} | Failure: ${p.classification} | Successful response: ${p.resolution || p.playbook || p.summary}`).join('\n')}\n\n`;
        }

        // Inject the active working directory into the prompt if specified
        let augmentedRequest = memoryPrompt + userRequest;
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

        try {
            await this._runLoop(userRequest);
            if (this.currentRun && !this.currentRun.finishedAt) {
                this._finishRun(this.isWaitingForInput ? 'paused' : 'completed');
            }
        } finally {
            this.isRunning = false;
        }
    }

    async resume(userInput) {
        if (this.isRunning) {
            console.warn("[Orchestrator] Task already running. Ignoring duplicate resume.");
            return;
        }
        if (this.pendingApproval) {
            await this._handleApprovalResponse(userInput);
            return;
        }
        if (this.pendingRepair) {
            await this._handleRepairResponse(userInput);
            return;
        }
        this.isRunning = true;
        this.isStopped = false;
        this.isWaitingForInput = false;
        this.onUpdate({ type: 'start', message: `Resuming task with user input...` });
        
        const lastMsg = this.context[this.context.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.toolCall && lastMsg.toolCall.name === 'askUserForInput') {
             this.context.push({ role: 'tool', name: 'askUserForInput', content: userInput });
        } else {
             this.context.push({ role: 'user', content: userInput });
        }

        try {
            await this._runLoop(null);
            if (this.currentRun && !this.currentRun.finishedAt) {
                this._finishRun(this.isWaitingForInput ? 'paused' : 'completed');
            }
        } finally {
            this.isRunning = false;
        }
    }

    stop() {
        this.isStopped = true;
        this.isRunning = false;
        this.isWaitingForInput = false;
        this._finishRun('stopped');
        this.onUpdate({ type: 'error', message: 'Mission forcefully terminated by the Boss.' });
    }

    async _runLoop(originalRequest) {
        let isTaskCompleted = false;
        for (; this.stepCount < this.maxSteps; this.stepCount++) {
            if (this.isStopped) {
                this.isStopped = false;
                break;
            }
            this.onUpdate({ type: 'step', message: `--- Step ${this.stepCount + 1} ---` });
            
            // ─── Dynamic Rate Limit Safety ──────────────────────────────────
            const quotaMode = await require('./core/config').get('QUOTA_MODE') || 'FREE';
            let delay = 6000; // Default FREE (Stay within 15 RPM)
            if (quotaMode === 'NORMAL') delay = 3000;
            if (quotaMode === 'HIGH') delay = 1000;
            
            await new Promise(r => setTimeout(r, delay));

            // Inject stateful tracking context and Dynamic Tool Rules
            let stateContext = "";
            if (this.lastUploadedFile) {
                stateContext += `[CURRENT_SYSTEM_STATE] Active File Context: "${this.lastUploadedFile}". If a user says "improve this", "run this", "change this", or "promote this", ALWAYS assume they mean this file.\n\n`;
            }

            // Dynamically grab all configured capability rules mapped to the tools matrix
            const ConfigService = require('./core/config');
            const allConfigs = await ConfigService.getAll();
            const activeRules = Object.entries(allConfigs)
                .filter(([k, v]) => k.startsWith('TOOL_') && k.endsWith('_RULES') && v)
                .map(([k, v]) => `- ${k.replace('TOOL_', '').replace('_RULES', '')}: ${v}`);

            if (activeRules.length > 0) {
                stateContext += `[CAPABILITY DIRECTIVES & USER RULES]\nYou MUST strictly adhere to the following customized behavioral rules when utilizing capabilities:\n${activeRules.join('\n')}\n`;
            }

            if (stateContext) {
                const systemIdx = this.context.findIndex(m => m.role === 'system');
                if (systemIdx !== -1) {
                    this.context[systemIdx].content = this.systemPrompt + "\n\n" + stateContext;
                }
            }

            // Ask LLM what to do next
            if (this.currentRun) this.currentRun.llmCalls += 1;
            const response = await this.llmService.generateResponse(this.context);

            if (response.text) {
                if (response.text.startsWith('MISSION BREACH:')) {
                    this.onUpdate({ type: 'error', message: response.text });
                } else {
                    this.onUpdate({ type: 'thought', message: response.text });
                }
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
                    this.isWaitingForInput = true;
                    this._finishRun('paused');
                    return; // Pause execution
                }

                // Execute the tool
                let result = await this.dispatchTool(response.toolCall);
                let resultString = String(result);

                // AUTO-RECOVERY: If a browser interaction fails, automatically scan for elements
                if (response.toolCall.name === 'browserAction' && 
                    ['click', 'clickPixel', 'type', 'keyPress', 'clickText', 'hover'].includes(response.toolCall.args.action) &&
                    (resultString.toLowerCase().includes('error') || resultString.toLowerCase().includes('failed') || resultString.toLowerCase().includes('not found'))) {
                    
                    this.onUpdate({ type: 'thought', message: `⚠️ Action failed. Initiating autonomous 'Auto-Scan' for recovery...` });
                    const recoveryScan = await this.tools.browserAction({ action: 'extractActiveElements' });
                    result = `Original Action Failed: ${resultString}\n\n[AUTO-RECOVERY SCAN DATA]:\n${recoveryScan}\n\nTip: Use the nexus-autoid-X or scan the Markdown to find the correct element for your next attempt.`;
                    resultString = String(result);
                }

                // PROACTIVE FEEDBACK: If tool result is an error, broadcast it as a thought immediately
                if (resultString.toLowerCase().includes('error') || resultString.toLowerCase().includes('missing')) {
                    this.onUpdate({ type: 'thought', message: `🔍 Workflow Insight: ${resultString}` });
                }

                const truncatedResult = resultString.length > 5000 ? resultString.substring(0, 5000) + '...' : resultString;

                this.onUpdate({ type: 'result', message: truncatedResult });

                // Add result back to context
                this.context.push({ role: 'tool', name: response.toolCall.name, content: result });

                await this._applySelfHealing(response.toolCall, resultString);
                if (this.pendingRepair) {
                    this.isWaitingForInput = true;
                    this._finishRun('paused');
                    return;
                }
            } else {
                // If the LLM is explicitly asking a question or for credentials, pause instead of completing
                const textLower = (response.text || "").toLowerCase();
                const isAskingQuestion = textLower.includes('?') || 
                                         textLower.includes('please provide') || 
                                         textLower.includes('i need your') ||
                                         textLower.includes('tell me') ||
                                         textLower.includes('what you would like me to do') ||
                                         textLower.includes('ready for your instructions');
                
                if (isAskingQuestion) {
                    this.onUpdate({ type: 'pause' });
                    this.isWaitingForInput = true;
                    this._finishRun('paused');
                    return; // Pause execution, keeping context alive for resume()
                }

                this.onUpdate({ type: 'complete', message: 'Task Complete. No further actions requested.' });
                isTaskCompleted = true;
                this._finishRun('completed');
                break;
            }
        }

        if (!isTaskCompleted) {
            this.onUpdate({ type: 'complete', message: 'Process finished.' });
            this._finishRun(this.isWaitingForInput ? 'paused' : 'completed');
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
        return this._dispatchTool(toolCall, {});
    }

    async _dispatchTool(toolCall, options = {}) {
        const { name, args } = toolCall;
        if (this.currentRun) {
            this.currentRun.toolCalls += 1;
            this.currentRun.lastTool = name;
            this.currentRun.toolsUsed[name] = (this.currentRun.toolsUsed[name] || 0) + 1;
        }
        try {
            const governance = GovernanceService.evaluate(toolCall);
            if (!options.skipGovernance && governance.requiresApproval && args?.boss_approved !== true) {
                this.pendingApproval = {
                    requestedAt: new Date().toISOString(),
                    toolCall,
                    reason: governance.reason,
                    preview: governance.preview,
                    details: governance.details || null
                };
                this._recordAudit('approval_requested', {
                    tool: name,
                    reason: governance.reason,
                    preview: governance.preview
                });
                this.onUpdate({
                    type: 'approval_requested',
                    message: `Approval required for ${name}. ${governance.reason}\n\nPreview:\n${governance.preview}\n\nReply with YES to approve or NO to cancel.`
                });
                this.isWaitingForInput = true;
                return `APPROVAL REQUIRED: ${governance.reason}\n${governance.preview}`;
            }
            if (governance.requiresApproval && (options.skipGovernance || args?.boss_approved === true)) {
                this._recordAudit('external_action_executed', {
                    tool: name,
                    preview: governance.preview
                });
            }
            switch (name) {
                case 'readFile': return await this.tools.readFile(args.absolutePath);
                case 'writeFile': return await this.tools.writeFile(args.absolutePath, args.content);
                case 'listDir': return await this.tools.listDir(args.absolutePath);
                case 'replaceFileContent': 
                    return await this.tools.replaceFileContent(args.absolutePath, args.startLine, args.endLine, args.targetContent, args.replacementContent);
                case 'multiReplaceFileContent':
                    return await this.tools.multiReplaceFileContent(args.absolutePath, args.chunks);
                case 'runCommand': return await this.tools.runCommand(args.command, args.cwd);
                case 'browserAction': 
                    const browserResult = await this.tools.browserAction(args);
                    
                    // Visual Feedback: Auto-screenshot after every meaningful navigation or interaction
                    const visualActions = ['open', 'click', 'clickPixel', 'type', 'keyPress', 'clickText', 'scroll', 'hover'];
                    if (visualActions.includes(args.action)) {
                        const screenshotName = `screenshot_${Date.now()}.png`;
                        const screenshotPath = path.join(this.taskDir, screenshotName);
                        await this.tools.browserAction({ action: 'annotateAndScreenshot', savePath: screenshotPath });
                        
                        // Relative URL for the frontend
                        const folderName = path.basename(this.taskDir);
                        const publicUrl = `/outputs/${folderName}/${screenshotName}`;
                        this.onUpdate({ type: 'thought', message: `🖼️ **Browser Update:**\n![Browser View](${publicUrl})` });
                    }
                    return browserResult;
                case 'generate_image': return await ImageGenTool.generateImage(args.prompt, args.savePath);
                case 'improveImage': return await ImageGenTool.improveImage(args.prompt, args.imagePath, args.savePath);
                case 'n8nSearch': return await this.tools.n8nSearch(args.query);
                case 'getN8nWorkflow': return await this.tools.getN8nWorkflow(args.path);
                case 'metaAds': {
                    const dangerousActions = [
                        'createCampaign', 'createAdSet', 'createAdCreative', 'createAd',
                        'publishOrganicPost', 'publishOrganicPhoto', 'publishOrganicVideo', 'publishOrganicReel'
                    ];
                    if (dangerousActions.includes(args.action) && args.boss_approved !== true) {
                        return "⚠️ MISSION BREACH: You attempted a dangerous action (spending budget or publishing publicly) without explicit approval. You MUST use 'askUserForInput' to show The Boss a preview of exactly what you are going to post/create, and ask for their approval. Once they say YES, call this tool again with 'boss_approved: true'.";
                    }

                    switch(args.action) {
                        case 'createCampaign': return await this.tools.metaAds.createCampaign(args.name, args.objective);
                        case 'createAdSet': return await this.tools.metaAds.createAdSet(args.campaignId, args.name, args.budget || 1000, args.targeting);
                        case 'createAdCreative': return await this.tools.metaAds.createAdCreative(args.name, args.title, args.body, args.imageHash || args.imageUrl, args.pageId, args.cta);
                        case 'createAd': return await this.tools.metaAds.createAd(args.adSetId, args.creativeId, args.name);
                        case 'publishOrganicPost': return await this.tools.metaAds.publishPagePost(args.pageId, args.message, args.link);
                        case 'publishOrganicPhoto': return await this.tools.metaAds.publishPagePhoto(args.pageId, args.message, args.imagePath);
                        case 'publishOrganicVideo': return await this.tools.metaAds.publishPageVideo(args.pageId, args.title, args.description, args.videoPath);
                        case 'publishOrganicReel': return await this.tools.metaAds.publishPageReel(args.pageId, args.description, args.videoPath);
                        case 'getPageInsights': return await this.tools.metaAds.getPageInsights(args.pageId);
                        case 'getAccountInfo': return await this.tools.metaAds.getAccountInfo();
                        case 'uploadImage': return await this.tools.metaAds.uploadImage(args.imagePath);
                        default: return `Unknown metaAds action: ${args.action}`;
                    }
                }
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
                case 'searchWeb': return await this.tools.searchWeb(args.query);
                case 'codeMap': return await this.tools.codeMap(args.absolutePath, args.maxDepth);
                case 'codeSearch': return await this.tools.codeSearch(args.absolutePath, args.query);
                case 'codeFindFn': return await this.tools.codeFindFn(args.absolutePath, args.functionName);
                case 'sendEmail': return await this.tools.sendEmail(args.to, args.subject, args.body);
                case 'readEmail': return await this.tools.readEmail(args.limit);
                case 'sendWhatsApp': return await this.tools.sendWhatsApp(args.phone, args.text);
                case 'sendWhatsAppMedia': return await this.tools.sendWhatsAppMedia(args.phone, args.mediaUrl, args.caption);
                case 'saveMemory': return await this.tools.saveMemory(args.content, args.category);
                case 'searchMemory': return await this.tools.searchMemory(args.query);
                case 'delegateToAgent': return await this.tools.delegateToAgent(args.agentType, args.task);
                default: return `Error: Tool ${name} not found.`;
            }
        } catch (error) {
            if (this.currentRun) {
                this.currentRun.errorCount += 1;
                this.currentRun.lastError = error.message;
            }
            return `Error executing tool: ${error.message}`;
        }
    }

    async _handleApprovalResponse(userInput) {
        const decision = GovernanceService.isApprovalResponse(userInput);
        const pending = this.pendingApproval;
        if (decision === null) {
            this.onUpdate({ type: 'input_requested', message: `Approval pending for ${pending.toolCall.name}. Please reply YES to approve or NO to cancel.` });
            return;
        }

        this.isRunning = true;
        this.isStopped = false;
        this.isWaitingForInput = false;

        try {
            if (!decision) {
                this._recordAudit('approval_rejected', { tool: pending.toolCall.name, preview: pending.preview });
                this.context.push({ role: 'user', content: `Approval rejected by user: ${userInput}` });
                this.pendingApproval = null;
                this.onUpdate({ type: 'thought', message: `Approval rejected for ${pending.toolCall.name}. Mission will continue without executing it.` });
                await this._runLoop(null);
                return;
            }

            const approvedCall = {
                ...pending.toolCall,
                args: { ...(pending.toolCall.args || {}), boss_approved: true }
            };
            this._recordAudit('approval_granted', { tool: approvedCall.name, preview: pending.preview });
            this.context.push({ role: 'user', content: `Approval granted by user: ${userInput}` });
            this.context.push({ role: 'assistant', content: '', toolCall: approvedCall });
            this.onUpdate({ type: 'action', name: approvedCall.name, args: approvedCall.args });
            this.pendingApproval = null;
            const result = await this._dispatchTool(approvedCall, { skipGovernance: true });
            this.onUpdate({ type: 'result', message: String(result).slice(0, 5000) });
            this.context.push({ role: 'tool', name: approvedCall.name, content: result });
            await this._runLoop(null);
        } finally {
            this.isRunning = false;
        }
    }

    _recordAudit(type, payload) {
        this.auditTrail.unshift({
            type,
            payload,
            at: new Date().toISOString()
        });
        this.auditTrail = this.auditTrail.slice(0, 100);
    }

    async _applySelfHealing(toolCall, resultString) {
        const classification = SelfHealingService.classify(toolCall, resultString);
        if (!classification) return;

        const playbook = SelfHealingService.getPlaybook(classification, toolCall);
        this.recoveryHistory.unshift({
            at: new Date().toISOString(),
            tool: toolCall.name,
            classification,
            playbook
        });
        this.recoveryHistory = this.recoveryHistory.slice(0, 50);
        this._recordAudit('self_healing_detected', { tool: toolCall.name, classification: classification.type });

        if (!playbook) return;

        if (playbook.strategy === 'auto_scan' && toolCall.name === 'browserAction') {
            this.onUpdate({ type: 'thought', message: `Self-healing detected a browser mismatch. Capturing fresh browser context for the Boss.` });
            const pageMap = await this.tools.browserAction({ action: 'getMarkdown' });
            const activeElements = await this.tools.browserAction({ action: 'extractActiveElements' });
            this.context.push({ role: 'tool', name: 'browserAction', content: `SELF-HEALING PAGE MAP:\n${pageMap}\n\nSELF-HEALING ACTIVE ELEMENTS:\n${activeElements}` });
            return;
        }

        if (playbook.strategy === 'wait_and_retry' && toolCall.name === 'browserAction') {
            this.onUpdate({ type: 'thought', message: `Self-healing detected a timeout. Waiting briefly and retrying for the Boss.` });
            const waitResult = await this.tools.browserAction({ action: 'waitForNetworkIdle', timeout: 5000 });
            this.context.push({ role: 'tool', name: 'browserAction', content: waitResult });
            return;
        }

        if (playbook.strategy === 'boss_repair_mode') {
            this.pendingRepair = {
                requestedAt: new Date().toISOString(),
                toolCall,
                classification,
                playbook
            };
            this.onUpdate({
                type: 'repair_suggested',
                message: `Self-healing detected: ${classification.summary}\n\nProposed repair for the Boss:\n${playbook.message}\n\nReply YES to let Nexus continue with guided repair, or NO to leave the task as-is.`
            });
        }
    }

    async _handleRepairResponse(userInput) {
        const decision = GovernanceService.isApprovalResponse(userInput);
        if (decision === null) {
            this.onUpdate({ type: 'input_requested', message: 'Repair mode is waiting for the Boss. Reply YES to continue with the guided repair or NO to skip it.' });
            return;
        }

        const pending = this.pendingRepair;
        this.pendingRepair = null;

        if (!decision) {
            this._recordAudit('repair_rejected', { tool: pending.toolCall.name, reason: pending.classification.type });
            this.context.push({ role: 'user', content: `Boss rejected self-healing repair: ${userInput}` });
            this.onUpdate({ type: 'thought', message: `Self-healing repair skipped by the Boss.` });
            return;
        }

        this._recordAudit('repair_approved', { tool: pending.toolCall.name, reason: pending.classification.type });
        await MemoryService.saveRecoveryPattern({
            tool: pending.toolCall.name,
            classification: pending.classification.type,
            summary: pending.classification.summary,
            playbook: pending.playbook.message,
            resolution: 'Boss approved guided repair mode'
        });
        this.context.push({
            role: 'user',
            content: `Boss approved self-healing repair. Continue by repairing the failure category "${pending.classification.type}" safely, then retry the task. Failure summary: ${pending.classification.summary}.`
        });
        await this.resume(`Boss approved repair mode. Repair the issue safely and continue.`);
    }

    _beginRun(request) {
        this.currentRun = {
            id: `run_${Date.now()}`,
            requestPreview: String(request || '').trim().slice(0, 160) || 'Mission',
            startedAt: new Date().toISOString(),
            finishedAt: null,
            status: 'running',
            toolCalls: 0,
            llmCalls: 0,
            toolsUsed: {},
            errorCount: 0,
            lastError: null,
            lastTool: null,
            steps: 0,
            clientId: this.currentClientId || null,
            estimatedCostUsd: 0
        };
    }

    _finishRun(status) {
        if (!this.currentRun || this.currentRun.finishedAt) return;
        this.currentRun.finishedAt = new Date().toISOString();
        this.currentRun.status = status;
        this.currentRun.steps = this.stepCount;
        this.currentRun.estimatedCostUsd = Number(((this.currentRun.llmCalls * 0.00035) + (this.currentRun.toolCalls * 0.0001)).toFixed(6));
        this.recentRuns.unshift(this.currentRun);
        this.recentRuns = this.recentRuns.slice(0, 12);
    }

    getMissionControlData() {
        const allRuns = [...this.recentRuns];
        if (this.currentRun && !this.currentRun.finishedAt) {
            allRuns.unshift({ ...this.currentRun, steps: this.stepCount });
        }

        const completedRuns = allRuns.filter((run) => run.finishedAt);
        const successRuns = completedRuns.filter((run) => run.status === 'completed');
        const pausedRuns = completedRuns.filter((run) => run.status === 'paused');
        const totalEstimatedCostUsd = completedRuns.reduce((sum, run) => sum + Number(run.estimatedCostUsd || 0), 0);
        const totalLlmCalls = completedRuns.reduce((sum, run) => sum + Number(run.llmCalls || 0), 0);

        return {
            activeRun: this.currentRun && !this.currentRun.finishedAt ? { ...this.currentRun, steps: this.stepCount } : null,
            pendingApproval: this.pendingApproval,
            pendingRepair: this.pendingRepair,
            auditTrail: this.auditTrail.slice(0, 20),
            recoveryHistory: this.recoveryHistory.slice(0, 20),
            recentRuns: allRuns,
            totals: {
                missions: completedRuns.length,
                successRate: completedRuns.length ? Math.round((successRuns.length / completedRuns.length) * 100) : 0,
                paused: pausedRuns.length,
                toolCalls: completedRuns.reduce((sum, run) => sum + (run.toolCalls || 0), 0),
                llmCalls: totalLlmCalls,
                estimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(6))
            }
        };
    }

    /**
     * Gets the current serializable state for persistence.
     */
    getPersistentState() {
        return {
            context: this.context,
            lastUploadedFile: this.lastUploadedFile,
            stepCount: this.stepCount,
            currentClientId: this.currentClientId,
            isWaitingForInput: this.isWaitingForInput,
            currentRun: this.currentRun,
            recentRuns: this.recentRuns,
            pendingApproval: this.pendingApproval,
            pendingRepair: this.pendingRepair,
            auditTrail: this.auditTrail,
            recoveryHistory: this.recoveryHistory
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
        if (state.currentClientId !== undefined) this.currentClientId = state.currentClientId;
        if (state.isWaitingForInput !== undefined) this.isWaitingForInput = state.isWaitingForInput;
        if (state.currentRun) this.currentRun = state.currentRun;
        if (state.recentRuns) this.recentRuns = state.recentRuns;
        if (state.pendingApproval) this.pendingApproval = state.pendingApproval;
        if (state.pendingRepair) this.pendingRepair = state.pendingRepair;
        if (state.auditTrail) this.auditTrail = state.auditTrail;
        if (state.recoveryHistory) this.recoveryHistory = state.recoveryHistory;
    }
}

// Entry point
if (require.main === module) {
    const path = require('path');
    const fs = require('fs');
    const taskDir = path.join(__dirname, 'outputs', 'cli_test_' + Date.now());
    if (!fs.existsSync(taskDir)) fs.mkdirSync(taskDir, { recursive: true });
    
    // Instantiate with console logger and the generated taskDir
    const orchestrator = new NexusOrchestrator((m) => {
        if (m.type !== 'thought') console.log(`[${m.type.toUpperCase()}] ${m.message}`);
    }, taskDir);
    
    const request = process.argv.slice(2).join(' ') || "What time is it right now? Use the terminal to find out.";
    orchestrator.execute(request).catch(console.error);
}

module.exports = NexusOrchestrator;
