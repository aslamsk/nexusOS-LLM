const fs = require('fs');
const path = require('path');
const FileSystemTool = require('./tools/fileSystem');
const TerminalTool = require('./tools/terminal');
const BrowserTool = require('./tools/browser');
const ImageGenTool = require('./tools/imageGen');
const SkillGenerator = require('./tools/skillGenerator');
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
const MarketingUtilsTool = require('./tools/marketingUtils');
const MemoryService = require('./core/memory');
const ProactiveScannerTool = require('./tools/proactiveScanner');
const SquadSystem = require('./core/squad');
const LLMService = require('./core/llm');
const GovernanceService = require('./core/governance');
const SelfHealingService = require('./core/selfHealing');
const MarketingService = require('./core/marketing');
const MarketingPrompts = require('./core/marketingPrompts');
const GoalInterpreter = require('./core/goalInterpreter');
const UsageTracker = require('./core/usageTracker');
const MissionMode = require('./core/missionMode');
const AgencyQuotePlanner = require('./core/agencyQuotePlanner');
const CommercialDocs = require('./core/commercialDocs');
const { db } = require('./core/firebase');
const ConfigService = require('./core/config');

/**
 * Nexus OS Orchestrator
 * The brain of the operation.
 */
class NexusOrchestrator {
    constructor(onUpdate = null, taskDir = null) {
        this.taskDir = taskDir;
        this._systemPromptPath = path.join(__dirname, 'core', 'system_prompt.md');
        // Dynamic system prompt
        Object.defineProperty(this, 'systemPrompt', {
            get: () => fs.readFileSync(this._systemPromptPath, 'utf8'),
            enumerable: true
        });
        this.context = [{ role: 'system', content: this.systemPrompt }];
        
        // Instantiate SkillGenerator
        const browserProfile = taskDir ? path.join(taskDir, '.browser_profile') : null;
        this.browserInstance = new BrowserTool(browserProfile);
        this.skillGen = new SkillGenerator(taskDir ? path.join(taskDir, 'skills') : null);

        this.tools = {
            readFile: (args) => FileSystemTool.readFile(args.absolutePath),
            writeFile: (args) => FileSystemTool.writeFile(args.absolutePath, args.content),
            listDir: (args) => FileSystemTool.listDir(args.absolutePath),
            replaceFileContent: (args) => FileSystemTool.replaceFileContent(args.absolutePath, args.startLine, args.endLine, args.targetContent, args.replacementContent),
            multiReplaceFileContent: (args) => FileSystemTool.multiReplaceFileContent(args.absolutePath, args.chunks),
            runCommand: (args) => TerminalTool.runCommand(args.command, args.cwd),
            browserAction: (args) => this.browserInstance.executeAction(args),
            generateImage: (args) => ImageGenTool.generateImage(args.prompt, args.savePath),
            createSkill: (args) => this.skillGen.createSkill(args.name, args.code, args.description),
            listSkills: () => this.skillGen.listSkills(),
            executeSkill: async (args) => {
                const skill = this.skillGen.loadSkill(args.name);
                if (!skill) return `Error: Skill '${args.name}' not found.`;
                return await skill.main(args.params || {});
            },
            n8nSearch: (args) => N8nDiscoverTool.searchWorkflows(args.query),
            getN8nWorkflow: (args) => N8nDiscoverTool.getWorkflow(args.id),
            removeBg: (args) => BackgroundRemovalTool.removeBg(args.inputPath, args.outputPath),
            metaAds: (args) => this._runMetaAdsAction(args),
            googleAds: (args) => this._runGoogleAdsAction(args),
            linkedinAds: (args) => this._runLinkedInAdsAction(args),
            openRouter: (args) => OpenRouterTool.executeAction(args),
            searchWeb: (args) => SearchTool.search(args.query),
            codeMap: (args) => CodeAwarenessTool.mapCodebase(args.absolutePath, args.maxDepth),
            codeSearch: (args) => CodeAwarenessTool.searchInCode(args.absolutePath, args.query),
            codeFindFn: (args) => CodeAwarenessTool.findFunction(args.absolutePath, args.functionName),
            sendEmail: (args) => EmailTool.sendEmail(args.to, args.subject, args.body),
            readEmail: (args) => EmailTool.readInbox(args.limit),
            sendWhatsApp: (args) => WhatsAppTool.sendMessage(args.phone, args.text),
            sendWhatsAppMedia: (args) => WhatsAppTool.sendMedia(args.phone, args.mediaUrl, args.caption),
            analyzeMarketingPage: (args) => MarketingUtilsTool.analyzePage(args.target, args.channels),
            scanCompetitors: (args) => MarketingUtilsTool.scanCompetitors(args.target, args.competitors, args.notes),
            generateSocialCalendar: (args) => MarketingUtilsTool.generateSocialCalendar(args.target, args.channels, args.weeks, args.theme, args.notes),
            saveMemory: (args) => MemoryService.saveMemory(args.content, args.category),
            searchMemory: (args) => MemoryService.searchMemory(args.query),
            scanNiche: (args) => ProactiveScannerTool.scanNiche(args.niche),
            proposeCampaign: (args) => ProactiveScannerTool.proposeCampaign(args.opportunityId),
            delegateToAgent: (args) => SquadSystem.delegate(args.agentType, args.task)
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
        this.currentMarketingWorkflow = null;
        this.pendingRequirement = null;
        this.currentSessionId = null;
        this.currentMissionMode = 'execute';
        this.manualMissionMode = null;
        this.currentWorkflowState = null;
        this.isStopped = false;
    }

    _isChatOnlyMode() {
        return String(this.currentMissionMode || '').toLowerCase() === 'chat';
    }

    /**
     * Stop the current execution loop immediately.
     */
    stop() {
        this.isStopped = true;
        this.isRunning = false;
        this.isWaitingForInput = false;
        this.pendingApproval = null;
        this.pendingRepair = null;
        this.pendingRequirement = null;
        
        // Signal tools to stop
        if (this.llmService && typeof this.llmService.stop === 'function') {
            this.llmService.stop();
        }
        
        // Note: BrowserTool stop is handled as a promise, but we mark the flag first
        this._finishRun('stopped');
        this.onUpdate({ type: 'thought', message: "🛑 **Kill Switch Activated:** Nexus is terminating all active processes and clearing the execution stack." });
    }

    /**
     * Reset the internal state for a fresh mission start.
     */
    reset() {
        this.stop();
        this.context = [{ role: 'system', content: this.systemPrompt }];
        this.currentClientId = null;
        this.currentMarketingWorkflow = null;
        this.currentOrganicMetaDraft = null;
        this.currentWorkflowState = null;
        this.isStopped = false; // Prepare for next use
        this.onUpdate({ type: 'thought', message: "✨ **System Purge:** All transient mission baggage has been cleared. Ready for fresh sovereign directives." });
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

        if (this._applyWorkflowIntent(userRequest)) {
            this._beginRun(userRequest);
        }

        // CRITICAL FIX: Reset context for a fresh mission to prevent "stale failure" baggage.
        // This ensures the AI starts with a clean slate (System Prompt + New Request).
        this.context = [{ role: 'system', content: this.systemPrompt }];
        
        // MISSION STABILITY: Reset transient state for every fresh mission to prevent pollution.
        // If the user isn't explicitly continuing a previous draft, we purge the old baggage.
        if (!this._isOrganicPublishIntent(userRequest)) {
            this.currentOrganicMetaDraft = null;
            this.currentWorkflowState = null;
            this.currentMarketingWorkflow = null;
        }

        // Recall Long-Term Memories
        const memories = await MemoryService.recallRecent(5);
        const recoveryPatterns = await MemoryService.findRecoveryPatterns(userRequest, 3);
        const detectedMarketingWorkflow = MarketingService.detectWorkflowFromText(userRequest);
        const detectedGoal = GoalInterpreter.interpretGoal(userRequest);
        const detectedCommercialQuote = this._detectCommercialQuoteRequest(userRequest);
        this.currentMissionMode = MissionMode.detectMissionMode(userRequest, this.manualMissionMode);
        this.currentMarketingWorkflow = detectedMarketingWorkflow ? detectedMarketingWorkflow.id : null;
        let memoryPrompt = "";
        memoryPrompt += MissionMode.buildModePrompt(this.currentMissionMode);
        memoryPrompt += this._buildExecutionProtocol(userRequest);
        if (memories.length > 0) {
            memoryPrompt += `### LONG-TERM MEMORY RECALL:\n${memories.map(m => `- ${m}`).join('\n')}\n\n`;
        }
        if (recoveryPatterns.length > 0) {
            memoryPrompt += `### RECOVERY PATTERN RECALL:\n${recoveryPatterns.map((p, idx) => `${idx + 1}. Tool: ${p.tool} | Failure: ${p.classification} | Successful response: ${p.resolution || p.playbook || p.summary}`).join('\n')}\n\n`;
        }
        if (detectedMarketingWorkflow) {
            const packId = ['audit', 'copy', 'ads', 'report'].includes(detectedMarketingWorkflow.id) ? detectedMarketingWorkflow.id : 'report';
            memoryPrompt += `${MarketingPrompts.buildPromptContext(packId, detectedMarketingWorkflow)}\n\n`;
            if (detectedMarketingWorkflow.id === 'ads') {
                memoryPrompt += `${MarketingPrompts.buildAdsExecutionContext(userRequest)}\n\n`;
            }
            memoryPrompt += `### MARKETING SPECIALISTS\n${detectedMarketingWorkflow.specialists.map((item) => `- ${item}`).join('\n')}\n\n`;
            if (detectedMarketingWorkflow.id === 'audit') {
                memoryPrompt += `${MarketingPrompts.buildAuditBundleContext({
                    workflow: detectedMarketingWorkflow,
                    target: '',
                    clientName: '',
                    notes: '',
                    budget: '',
                    channels: []
                })}\n\n`;
            }
        }
        if (detectedGoal) {
            memoryPrompt += `### GOAL INTERPRETER\n${GoalInterpreter.buildExecutionBrief(detectedGoal)}\n\n`;
            this.onUpdate({
                type: 'thought',
                message: `Goal detected: ${detectedGoal.targetValue} ${detectedGoal.metricLabel} via ${detectedGoal.channels.join(', ')}. Nexus is expanding the Boss request into an execution plan.`
            });
        }
        if (detectedCommercialQuote) {
            const quoteDefaults = this._extractCommercialQuoteDefaults(userRequest);
            memoryPrompt += `### COMMERCIAL QUOTE INTERPRETER
COMMERCIAL QUOTE REQUEST DETECTED.
- Do not use web search or browser research unless the Boss explicitly asks for benchmarking.
- Use agency quote planning directly.
- Build a commercial quote for recurring work using the commercial quote tools.
- Include AI/model cost after free-tier exhaustion, agency profit, and export-ready documents.
- Prefer generating PDF/CSV/Markdown quote artifacts in the current task folder.
- If client identity is missing, use a generic client label and continue.
Suggested defaults:
${JSON.stringify(quoteDefaults, null, 2)}

`;
            this.onUpdate({
                type: 'thought',
                message: 'Commercial quote request detected. Nexus is switching to direct finance planning instead of search.'
            });
        }
        this.onUpdate({ type: 'thought', message: `Mission mode: ${this.currentMissionMode.toUpperCase()}. Nexus will execute directly and still pause only for real approvals or missing setup.` });

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
            if (this._isChatOnlyMode()) {
                await this._runChatLoop(userRequest);
            } else {
                await this._runLoop(userRequest);
            }
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
        if (this.pendingRequirement) {
            await this._handleRequirementResponse(userInput);
            return;
        }
        this.isRunning = true;
        this.isStopped = false;
        this.isWaitingForInput = false;
        this.onUpdate({ type: 'start', message: `Resuming task with user input...` });
        this._applyWorkflowIntent(userInput);

        const organicPublishResult = await this._resumeOrganicMetaPublish(userInput);
        if (organicPublishResult) {
            this.isRunning = false;
            return;
        }
        
        const lastMsg = this.context[this.context.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.toolCall && lastMsg.toolCall.name === 'askUserForInput') {
             this.context.push({ role: 'tool', name: 'askUserForInput', content: userInput });
        } else {
             this.context.push({ role: 'user', content: userInput });
        }

        try {
            if (this._isChatOnlyMode()) {
                await this._runChatLoop(null);
            } else {
                await this._runLoop(null);
            }
            if (this.currentRun && !this.currentRun.finishedAt) {
                this._finishRun(this.isWaitingForInput ? 'paused' : 'completed');
            }
        } finally {
            this.isRunning = false;
        }
    }

    _extractOrganicMetaDraft(text = '') {
        const value = String(text || '');
        const hasPromotionContext = /\bfacebook\b|\binstagram\b|\bmeta\b/i.test(value);
        const title = value.match(/\*\*Title:\*\*\s*([^\n]+)/i)?.[1]?.trim() || '';
        const description = value.match(/\*\*Description:\*\*\s*([\s\S]*?)\n\s*\*\*Call to Action:\*\*/i)?.[1]?.trim() || '';
        const ctaLine = value.match(/\*\*Call to Action:\*\*\s*([^\n]+)/i)?.[1]?.trim() || '';
        const link = value.match(/\*\*Link:\*\*\s*(https?:\/\/[^\s]+)/i)?.[1]?.trim() || '';
        const image = value.match(/\*\*Image:\*\*\s*(https?:\/\/[^\s]+)/i)?.[1]?.trim() || '';
        const tagsBlock = value.match(/\*\*Tags\/Hashtags:\*\*\s*([\s\S]*?)(?:\n\[Download|\nBoss|\nNexus|$)/i)?.[1]?.trim() || '';
        const message = description
            ? `${title ? `${title}\n\n` : ''}${description}${tagsBlock ? `\n\n${tagsBlock}` : ''}`.trim()
            : '';

        if (!hasPromotionContext || !message || !link) return null;
        return {
            channel: 'meta_organic',
            title,
            description,
            message,
            cta: /shop now/i.test(ctaLine) ? 'SHOP_NOW' : 'LEARN_MORE',
            ctaLabel: ctaLine || 'SHOP NOW',
            link,
            imagePath: image || null,
            tags: tagsBlock || '',
            channels: ['facebook', 'instagram'],
            preparedAt: new Date().toISOString()
        };
    }

    _setWorkflowState(nextState = null) {
        this.currentWorkflowState = nextState ? { ...nextState, updatedAt: new Date().toISOString() } : null;
    }

    _applyWorkflowIntent(text = '') {
        const value = String(text || '').toLowerCase();
        if (!value.trim()) return false;

        const wantsQuote = /\b(quote|quotation|invoice|pricing|estimate|proposal|quote plan)\b/.test(value);
        const wantsOrganicPromote = /\b(promote|publish|post)\b/.test(value) && /\b(organic|facebook|instagram|meta)\b/.test(value);

        if (wantsQuote) {
            this._setWorkflowState({
                domain: 'marketing',
                channel: /\bmeta|facebook|instagram\b/.test(value) ? 'meta' : 'general',
                mode: 'quote',
                stage: 'planning'
            });
            return true;
        }

        if (wantsOrganicPromote || this._isOrganicPublishIntent(text)) {
            // Only transition if we are NOT already specialized in another modes (like browser actions)
            if (this.currentMissionMode === 'discuss' || this.currentMissionMode === 'marketing') {
                this._setWorkflowState({
                    domain: 'marketing',
                    channel: 'meta',
                    mode: 'organic_publish',
                    stage: this.currentOrganicMetaDraft ? 'draft_ready' : 'drafting'
                });
                return true;
            }
        }

        return false;
    }

    _isOrganicPublishIntent(text = '') {
        const value = String(text || '').trim().toLowerCase();
        if (!value) return false;
        
        // HARDENED CHECK: Only accept generic "continue/yes" if the system is ALREADY in an organic publish state.
        // This stops "continue" from hijacking unrelated browser tasks.
        const isGenericProceed = ['continue', 'proceed', 'publish', 'promote it', 'post it', 'launch it', 'go live', 'yes', 'y', 'approve', 'approved', 'boss approved'].includes(value);
        if (isGenericProceed) {
            return this.currentWorkflowState?.mode === 'organic_publish' || !!this.currentOrganicMetaDraft;
        }

        return /\b(promote|publish|post|go live|launch)\b/.test(value) && /\bfacebook|instagram|meta\b/.test(value);
    }

    async _resumeOrganicMetaPublish(userInput) {
        if (!this.currentOrganicMetaDraft || !this._isOrganicPublishIntent(userInput)) return false;

        const pageId = await ConfigService.get('META_PAGE_ID');
        const args = {
            action: 'publishOrganicPost',
            pageId: pageId || null,
            message: this.currentOrganicMetaDraft.message,
            link: this.currentOrganicMetaDraft.link,
            imagePath: this.currentOrganicMetaDraft.imagePath || this.lastUploadedFile || null,
            channels: this.currentOrganicMetaDraft.channels || ['facebook', 'instagram'],
            cta: this.currentOrganicMetaDraft.cta,
            boss_approved: false
        };

        const missingPublishFields = this._validateMetaOrganicArgs(args);
        this.context.push({ role: 'user', content: userInput });
        if (missingPublishFields) {
            this.onUpdate({ type: 'input_requested', message: missingPublishFields });
            this.isWaitingForInput = true;
            return true;
        }

        const preview = [
            `Prepared organic Meta publish payload detected from the previous draft.`,
            `Title: ${this.currentOrganicMetaDraft.title || 'Untitled post'}`,
            `CTA: ${this.currentOrganicMetaDraft.ctaLabel || 'SHOP NOW'}`,
            `Link: ${this.currentOrganicMetaDraft.link}`,
            `Image: ${this.currentOrganicMetaDraft.imagePath || 'none'}`
        ].join('\n');

        this.pendingApproval = {
            requestedAt: new Date().toISOString(),
            toolCall: { name: 'metaAds', args },
            reason: 'This action will publish the prepared organic Meta post to Facebook/Instagram.',
            preview,
            details: {
                type: 'meta_organic_post',
                pageId: args.pageId,
                messagePreview: String(args.message || '').slice(0, 400),
                link: args.link
            }
        };
        this.onUpdate({
            type: 'approval_requested',
            message: `Prepared organic Meta post is ready. Reply YES to publish it now or NO to cancel.\n\n${preview}`
        });
        this.isWaitingForInput = true;
        return true;
    }

    _shouldAutoRequestOrganicApproval(userRequest = '', responseText = '') {
        const request = String(userRequest || '').toLowerCase();
        const response = String(responseText || '').toLowerCase();
        const wantsOrganicPublish =
            /\borganic\b/.test(request) &&
            /\b(meta|facebook|instagram)\b/.test(request) &&
            /\b(publish|post|promote)\b/.test(request);
        const askedForApproval =
            /\bask for approval\b/.test(request) ||
            /\bafter i reply yes\b/.test(request) ||
            /\bafter i say yes\b/.test(request);
        const responseRequestsApproval =
            /\bapprove\b/.test(response) &&
            /\bpublish\b/.test(response);
        const workflowReadyForApproval =
            this.currentWorkflowState?.mode === 'organic_publish' ||
            /\bpublish-ready\b/.test(request) ||
            /\bpublish-ready\b/.test(response);
        return wantsOrganicPublish && (askedForApproval || responseRequestsApproval || workflowReadyForApproval);
    }

    async _queueOrganicDraftApprovalFromDraft() {
        if (!this.currentOrganicMetaDraft) return false;

        const pageId = await ConfigService.get('META_PAGE_ID');
        const args = {
            action: 'publishOrganicPost',
            pageId: pageId || null,
            message: this.currentOrganicMetaDraft.message,
            link: this.currentOrganicMetaDraft.link,
            imagePath: this.currentOrganicMetaDraft.imagePath || this.lastUploadedFile || null,
            channels: this.currentOrganicMetaDraft.channels || ['facebook', 'instagram'],
            cta: this.currentOrganicMetaDraft.cta,
            boss_approved: false
        };

        const missingPublishFields = this._validateMetaOrganicArgs(args);
        if (missingPublishFields) {
            this.onUpdate({ type: 'input_requested', message: missingPublishFields });
            this.isWaitingForInput = true;
            return true;
        }

        const preview = [
            `Prepared organic Meta publish payload detected from the previous draft.`,
            `Title: ${this.currentOrganicMetaDraft.title || 'Untitled post'}`,
            `CTA: ${this.currentOrganicMetaDraft.ctaLabel || 'SHOP NOW'}`,
            `Link: ${this.currentOrganicMetaDraft.link}`,
            `Image: ${this.currentOrganicMetaDraft.imagePath || 'none'}`
        ].join('\n');

        this.pendingApproval = {
            requestedAt: new Date().toISOString(),
            toolCall: { name: 'metaAds', args },
            reason: 'This action will publish the prepared organic Meta post to Facebook/Instagram.',
            preview,
            details: {
                type: 'meta_organic_post',
                pageId: args.pageId,
                messagePreview: String(args.message || '').slice(0, 400),
                link: args.link
            }
        };
        this.onUpdate({
            type: 'approval_requested',
            message: `Prepared organic Meta post is ready. Reply YES to publish it now or NO to cancel.\n\n${preview}`
        });
        this.isWaitingForInput = true;
        this._setWorkflowState({
            domain: 'marketing',
            channel: 'meta',
            mode: 'organic_publish',
            stage: 'awaiting_approval'
        });
        return true;
    }

    _formatToolResult(result) {
        if (typeof result === 'string') return result;
        if (result === null || result === undefined) return String(result);
        try {
            return JSON.stringify(result, null, 2);
        } catch (error) {
            return String(result);
        }
    }

    _getActiveMediaPath(args = {}) {
        return args.imagePath || args.videoPath || args.filePath || this.lastUploadedFile || null;
    }

    async _recordMediaUsage(provider, model, usageTier = 'paid', estimatedCostUsd = 0) {
        if (!this.currentRun) return;
        const usageEvent = await UsageTracker.recordMediaUsage({
            provider,
            model,
            clientId: this.currentClientId || null,
            sessionId: this.currentSessionId || null,
            runId: this.currentRun.id,
            requestPreview: this.currentRun.requestPreview,
            usageTier,
            estimatedCostUsd
        });
        const usageKey = `${usageEvent.provider}::${usageEvent.model}`;
        const currentEntry = this.currentRun.providerUsage?.[usageKey] || {
            provider: usageEvent.provider,
            model: usageEvent.model,
            calls: 0,
            freeCalls: 0,
            paidCalls: 0,
            estimatedCostUsd: 0
        };
        currentEntry.calls += 1;
        currentEntry.freeCalls += usageEvent.usageTier === 'free' ? 1 : 0;
        currentEntry.paidCalls += usageEvent.usageTier === 'paid' ? 1 : 0;
        currentEntry.estimatedCostUsd = Number((currentEntry.estimatedCostUsd + Number(usageEvent.estimatedCostUsd || 0)).toFixed(6));
        this.currentRun.providerUsage = this.currentRun.providerUsage || {};
        this.currentRun.providerUsage[usageKey] = currentEntry;
    }

    _detectCommercialQuoteRequest(text) {
        const value = String(text || '').toLowerCase();
        
        // Explicitly exclude browser-centric missions that sometimes overlap with commercial terms
        const isBrowserMission = /\b(open|browser|login|sign in|signup|quiz|form|submit|fill|navigate|read questions?)\b/.test(value);
        if (isBrowserMission) return false;

        const isOrganicPublishRequest =
            /\b(publish|post|promote|organic)\b/.test(value) &&
            /\b(meta|facebook|instagram)\b/.test(value);
        if (isOrganicPublishRequest) return false;

        const hasCommercialIntent = /\b(commercial quote|quotation|invoice|pricing|cost breakdown|agency proposal)\b/.test(value);
        const hasScopedWork = /\b(meta ads?|google ads?|linkedin ads?|banner pack|creative set|management retainer|deliverables?)\b/.test(value);
        
        return hasCommercialIntent && hasScopedWork;
    }

    _buildExecutionProtocol(userRequest) {
        const value = String(userRequest || '').toLowerCase();
        const parts = [
            '### NEXUS EXECUTION PROTOCOL',
            '- First understand the Boss objective, then identify the exact missing details.',
            '- If required details are missing, ask only for the exact missing fields and wait.',
            '- Before taking meaningful action, produce a short numbered plan that matches the available tools.',
            '- Do not invent tool capabilities. Use only the exact supported tool names and action names.',
            '- Prefer deterministic tool use over generic chat explanations when a supported tool exists.'
        ];

        if (/\b(browser|open|login|sign in|signup|dashboard|website|portal|google ai studio|setup|configure|apikey|api key|console)\b/.test(value)) {
            parts.push('### BROWSER ACTION RULES');
            parts.push('- In PLAN mode for browser work, first analyze the live page state before attempting form entry or clicks.');
            parts.push('- Preferred browser sequence: `open` -> `waitForNetworkIdle` or `waitForSelector` -> `getMarkdown` -> `extractActiveElements` -> choose target -> interact.');
            parts.push('- Supported field actions: `type`, `clearAndType`, `focus`, `click`, `clickText`, `keyPress`, `hover`, `scroll`, `extract`, `getMarkdown`, `extractActiveElements`.');
            parts.push("- **CRITICAL**: After any 'click', 'clickText', or 'type' action, you MUST immediately call 'getMarkdown' or 'extractActiveElements' again to see the 'Visual State' of the page. Do not assume the page hasn't changed.");
            parts.push('- If selector targeting is unclear, use `extractActiveElements` or `getMarkdown` before proceeding.');
        }

        if (/\bquiz\b|\bquestion\b|\bsubmit\b/.test(value)) {
            parts.push('### QUIZ / FORM WORK RULES');
            parts.push('- If the Boss already provided form values like name, mobile, city, URL, or submit instruction, use them directly.');
            parts.push('- After the quiz opens, read the visible questions and options from the page with `getMarkdown` and `extractActiveElements` before answering.');
            parts.push('- Do not ask the Boss to provide quiz questions or answers if they are visible on the page.');
            parts.push('- Work through the quiz question by question, choose the best answer from the page, and submit only after all questions are handled.');
            parts.push('- If answer targets are unclear, scan again, scroll if needed, and retry with visible text or coordinates before pausing.');
        }

        if (this._detectCommercialQuoteRequest(userRequest)) {
            parts.push('### COMMERCIAL WORK RULES');
            parts.push('- For quote/invoice requests, prefer direct commercial planner tools instead of search or browser research.');
            parts.push('- Treat ad spend as passthrough unless the Boss explicitly wants it included in markup.');
        }

        return `${parts.join('\n')}\n\n`;
    }

    _extractCommercialQuoteDefaults(text) {
        const value = String(text || '');
        const numberFrom = (regex, fallback) => Number(value.match(regex)?.[1] || fallback);
        const bannerCount =
            numberFrom(/(\d+)\s*banners?/i, 0) ||
            numberFrom(/banners?\s*(?:design(?:ing)?\s*)?(?:for|x)?\s*(\d+)\s*ads?/i, 0) ||
            numberFrom(/(\d+)\s*ads?/i, 0) ||
            1;
        const monthCount = /(?:one|1)\s*month/i.test(value) ? 1 : numberFrom(/(\d+)\s*months?/i, 0);
        const inferredWeeks = monthCount > 0 ? monthCount * 4 : numberFrom(/(\d+)\s*weeks?/i, 0);
        const wantsAds = /meta|facebook|instagram|google ads?|linkedin|paid ads?|digital marketing|promotion|promot/i.test(value);
        const weeklyAds = numberFrom(/(\d+)\s*ads?\s*\/\s*week/i, 0) || numberFrom(/(\d+)\s*ads?\s*per\s*week/i, 0);
        const duration = numberFrom(/(\d+)\s*weeks?/i, 0) || (monthCount ? monthCount * 4 : 4);

        return {
            campaignName: 'Agency growth package',
            weeklyAdsCount: weeklyAds,
            durationWeeks: duration,
            bannerCount,
            carouselCount: numberFrom(/(\d+)\s*carousel/i, 0),
            videoCount: numberFrom(/(\d+)\s*video/i, 0),
            contentDeliverables: /content|caption|description|copy/i.test(value) ? Math.max(1, numberFrom(/(\d+)\s*(?:content|caption|description|cop(?:y|ies))/i, 1)) : 0,
            tagPackages: /tags?|keywords?|hashtags?/i.test(value) ? Math.max(1, numberFrom(/(\d+)\s*(?:tag|keyword|hashtag)/i, 1)) : 0,
            reportCount: /report/i.test(value) ? 1 : 0,
            auditCount: /audit/i.test(value) ? 1 : 0,
            metaAdsWeeks: /meta|facebook|instagram|digital marketing|paid ads?|promotion|promot/i.test(value) ? duration : 0,
            googleAdsWeeks: /google/i.test(value) ? duration : 0,
            linkedinAdsWeeks: /linkedin/i.test(value) ? duration : 0,
            websiteProject: /website|landing page|web development/i.test(value),
            websitePages: /website|landing page|web development/i.test(value) ? numberFrom(/(\d+)\s*pages?/i, 1) : 1,
            adSpendMonthly: numberFrom(/(?:ad spend|budget)[^\d]*(\d+(?:\.\d+)?)/i, 0),
            profitMarginPct: 35,
            taxPct: 0,
            currency: /(?:usd|\$|dollars?)/i.test(value) ? 'USD' : 'INR',
            includeStrategyRetainer: true,
            notes: `${value}${wantsAds && /client wish|client choice|as per client wish/i.test(value) ? '\nAd spend is excluded and will be decided by the client.' : ''}`
        };
    }

    async _createAgencyQuoteArtifacts(args = {}) {
        const plan = AgencyQuotePlanner.buildPlan(args);
        const model = CommercialDocs.buildQuoteDocumentModel(plan, {
            clientName: args.clientName || (this.currentClientId ? `Client ${this.currentClientId}` : 'Client'),
            clientCompany: args.clientCompany || '',
            clientEmail: args.clientEmail || '',
            notes: args.notes || ''
        });
        const baseName = `agency-quote-${Date.now()}`;
        const mdName = `${baseName}.md`;
        const csvName = `${baseName}.csv`;
        const pdfName = `${baseName}.pdf`;
        const mdPath = path.join(this.taskDir, mdName);
        const csvPath = path.join(this.taskDir, csvName);
        const pdfPath = path.join(this.taskDir, pdfName);
        const markdown = [
            '# Nexus OS Agency Quote',
            '',
            `Quote Number: ${model.quoteNumber}`,
            `Client: ${model.clientName}`,
            model.clientCompany ? `Company: ${model.clientCompany}` : '',
            model.clientEmail ? `Email: ${model.clientEmail}` : '',
            `Created: ${model.createdAt.toLocaleString()}`,
            `Valid Until: ${model.validUntil.toLocaleDateString()}`,
            '',
            '## Scope',
            ...model.items.map((item) => `- ${item.description} | Qty ${item.quantity} | ${item.lineTotal} ${model.currency}`),
            '',
            '## Commercial Summary',
            `- Base Cost: ${model.baseCost} ${model.currency}`,
            `- Agency Profit (${model.profitMarginPct}%): ${model.profitAmount} ${model.currency}`,
            `- Tax (${model.taxPct}%): ${model.taxAmount} ${model.currency}`,
            `- Total: ${model.total} ${model.currency}`,
            '',
            '## Assumptions',
            ...plan.assumptions.map((line) => `- ${line}`),
            model.notes ? '' : '',
            model.notes ? `## Notes\n${model.notes}` : ''
        ].filter(Boolean).join('\n');
        fs.writeFileSync(mdPath, markdown, 'utf8');
        fs.writeFileSync(csvPath, CommercialDocs.buildQuoteCsv(model), 'utf8');
        fs.writeFileSync(pdfPath, CommercialDocs.buildQuotePdfBuffer(model, plan));
        const folderName = path.basename(this.taskDir);
        return {
            ok: true,
            title: plan.title,
            pricing: plan.pricing,
            aiOps: plan.aiOps,
            assumptions: plan.assumptions,
            files: {
                markdown: `/outputs/${folderName}/${mdName}`,
                csv: `/outputs/${folderName}/${csvName}`,
                pdf: `/outputs/${folderName}/${pdfName}`
            }
        };
    }

    async _handleCommercialQuoteShortcut(userRequest) {
        if (!this._detectCommercialQuoteRequest(userRequest)) return false;

        const args = this._extractCommercialQuoteDefaults(userRequest);
        this.currentMissionMode = 'plan';
        this.onUpdate({
            type: 'thought',
            message: 'Commercial quote request confirmed. Nexus is using the agency quote planner directly instead of generic discussion/search flow.'
        });

        const toolCall = { name: 'createAgencyQuoteArtifacts', args };
        this.context.push({ role: 'assistant', content: '', toolCall });
        this.onUpdate({ type: 'action', name: toolCall.name, args: toolCall.args });
        this.onUpdate({
            type: 'thought',
            message: 'Execution engine: Nexus OS commercial quote planner with agency pricing and document generation.'
        });

        const result = await this._createAgencyQuoteArtifacts(args);
        this.onUpdate({ type: 'result', message: this._formatToolResult(result).slice(0, 5000) });
        this.context.push({ role: 'tool', name: toolCall.name, content: result });

        const pricing = result.pricing || {};
        const summary = [
            `Commercial quote prepared for **${result.title}**.`,
            '',
            'Download files:',
            `- [Download PDF Quote](${result.files.pdf})`,
            `- [Download CSV Quote](${result.files.csv})`,
            `- [Download Markdown Quote](${result.files.markdown})`,
            '',
            `Quoted total: ${pricing.currency || 'USD'} ${Number(pricing.total || 0).toFixed(2)}`,
            `Base cost: ${pricing.currency || 'USD'} ${Number(pricing.baseCost || 0).toFixed(2)}`,
            `Agency profit: ${pricing.currency || 'USD'} ${Number(pricing.profitAmount || 0).toFixed(2)}`,
            pricing.passthroughCost ? `Passthrough cost: ${pricing.currency || 'USD'} ${Number(pricing.passthroughCost || 0).toFixed(2)}` : 'Passthrough cost: excluded'
        ].join('\n');

        this.onUpdate({ type: 'complete', message: summary });
        this.context.push({ role: 'assistant', content: summary });
        this._finishRun('completed');
        return true;
    }

    async _toPublicMediaUrl(mediaPath) {
        if (!mediaPath) return null;
        if (/^https?:\/\//i.test(mediaPath)) return mediaPath;

        const normalized = path.resolve(mediaPath).replace(/\\/g, '/');
        const appBaseUrl = (await require('./core/config').get('APP_BASE_URL')) || process.env.APP_BASE_URL || 'http://localhost:3000';
        const uploadsRoot = path.join(__dirname, 'uploads').replace(/\\/g, '/');
        const outputsRoot = path.join(__dirname, 'outputs').replace(/\\/g, '/');

        if (normalized.startsWith(uploadsRoot)) {
            const fileName = path.basename(normalized);
            return `${appBaseUrl.replace(/\/$/, '')}/uploads/${encodeURIComponent(fileName)}`;
        }

        if (normalized.startsWith(outputsRoot)) {
            const relativePath = normalized.slice(outputsRoot.length).replace(/^\/+/, '');
            return `${appBaseUrl.replace(/\/$/, '')}/outputs/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
        }

        return null;
    }

    async _describeExecutionEngine(toolCall) {
        const { name, args = {} } = toolCall || {};
        if (!name) return null;

        if (name === 'generate_image' || name === 'improveImage') {
            return 'Execution engine: Google Imagen 4 (`imagen-4.0-generate-001`).';
        }

        if (name === 'generateVideo') {
            if (args.prompt) {
                return 'Execution engine: Google Veo 3.1 first, then Replicate, then Gemini+FFmpeg fallback if needed.';
            }
            return 'Execution engine: local FFmpeg image-to-video fallback.';
        }

        if (name === 'openRouterChat') {
            const configuredModel = args.model || await require('./core/config').get('OPENROUTER_MODEL') || 'openrouter/free';
            return `Execution engine: OpenRouter using model \`${configuredModel}\`.`;
        }

        if (name === 'metaAds') return 'Execution engine: Meta Graph API.';
        if (['googleAdsCreateCampaign', 'googleAdsListCampaigns', 'googleAdsCreateBudget', 'googleAdsCreateAdGroup', 'googleAdsAddKeywords', 'googleAdsCreateResponsiveSearchAd'].includes(name)) return 'Execution engine: Google Ads API.';
        if (name === 'linkedinPublishPost') return 'Execution engine: LinkedIn API.';
        if (name === 'sendEmail' || name === 'readEmail') return 'Execution engine: Gmail SMTP/IMAP.';
        if (name === 'sendWhatsApp' || name === 'sendWhatsAppMedia') return 'Execution engine: WhatsApp Cloud API.';
        if (name === 'browserAction') return 'Execution engine: Browser sub-agent (Puppeteer).';
        if (name === 'searchWeb') return 'Execution engine: Tavily Search API (primary) with Brave fallback.';
        if (name === 'buildAgencyQuotePlan' || name === 'createAgencyQuoteArtifacts') return 'Execution engine: Nexus OS commercial quote planner with agency pricing and document generation.';

        return null;
    }

    async _runLoop(originalRequest) {
        let isTaskCompleted = false;
        for (; this.stepCount < this.maxSteps; this.stepCount++) {
            if (this.isStopped) break;
            this.onUpdate({ type: 'step', message: `--- Step ${this.stepCount + 1} ---` });
            
            // ─── Dynamic Rate Limit Safety ──────────────────────────────────
            const quotaMode = await require('./core/config').get('QUOTA_MODE') || 'FREE';
            let delay = 6000; // Default FREE (Stay within 15 RPM)
            if (quotaMode === 'NORMAL') delay = 3000;
            if (quotaMode === 'HIGH') delay = 1000;
            
            await new Promise(r => setTimeout(r, delay));
            if (this.isStopped) break;

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
            const response = await this.llmService.generateResponse(this.context, { mode: this.currentMissionMode });
            if (this.isStopped) break;
            if (this.currentRun) {
                const previousProvider = this.currentRun.lastLlmProvider;
                if (response.provider) this.currentRun.lastLlmProvider = response.provider;
                if (response.model) this.currentRun.lastLlmModel = response.model;
                if (previousProvider && response.provider && previousProvider !== response.provider) {
                    this.currentRun.providerSwitches = this.currentRun.providerSwitches || [];
                    this.currentRun.providerSwitches.push({
                        at: new Date().toISOString(),
                        from: previousProvider,
                        to: response.provider,
                        model: response.model || null
                    });
                }
                if (response.provider || response.model) {
                    const usageEvent = await UsageTracker.recordLlmUsage({
                        provider: response.provider,
                        model: response.model,
                        clientId: this.currentClientId || null,
                        sessionId: this.currentSessionId || null,
                        runId: this.currentRun.id,
                        requestPreview: this.currentRun.requestPreview,
                        mode: this.currentMissionMode,
                        inputTokens: response.usage?.inputTokens || 0,
                        outputTokens: response.usage?.outputTokens || 0,
                        totalTokens: response.usage?.totalTokens || 0
                    });
                    const usageKey = `${usageEvent.provider}::${usageEvent.model}`;
                    const currentEntry = this.currentRun.providerUsage?.[usageKey] || {
                        provider: usageEvent.provider,
                        model: usageEvent.model,
                        calls: 0,
                        freeCalls: 0,
                        paidCalls: 0,
                        estimatedCostUsd: 0
                        ,
                        inputTokens: 0,
                        outputTokens: 0,
                        totalTokens: 0
                    };
                    currentEntry.calls += 1;
                    currentEntry.freeCalls += usageEvent.usageTier === 'free' ? 1 : 0;
                    currentEntry.paidCalls += usageEvent.usageTier === 'paid' ? 1 : 0;
                    currentEntry.estimatedCostUsd = Number((currentEntry.estimatedCostUsd + Number(usageEvent.estimatedCostUsd || 0)).toFixed(6));
                    currentEntry.inputTokens += Number(usageEvent.inputTokens || 0);
                    currentEntry.outputTokens += Number(usageEvent.outputTokens || 0);
                    currentEntry.totalTokens += Number(usageEvent.totalTokens || 0);
                    this.currentRun.providerUsage = this.currentRun.providerUsage || {};
                    this.currentRun.providerUsage[usageKey] = currentEntry;
                }
            }

            if (response.text) {
                const organicDraft = this._extractOrganicMetaDraft(response.text);
                if (organicDraft) {
                    this.currentOrganicMetaDraft = organicDraft;
                    this._setWorkflowState({
                        domain: 'marketing',
                        channel: 'meta',
                        mode: 'organic_publish',
                        stage: 'draft_ready'
                    });
                    this._recordAudit('organic_meta_draft_prepared', {
                        link: organicDraft.link,
                        cta: organicDraft.cta,
                        title: organicDraft.title
                    });
                }
                if (response.text.startsWith('MISSION BREACH:')) {
                    this.onUpdate({ type: 'error', message: response.text });
                } else {
                    this.onUpdate({ type: 'thought', message: response.text });
                }
                this.context.push({ role: 'assistant', content: response.text });

                if (organicDraft && this._shouldAutoRequestOrganicApproval(originalRequest || this.context.find(m => m.role === 'user')?.content || '', response.text)) {
                    if (await this._queueOrganicDraftApprovalFromDraft()) {
                        this._finishRun('paused');
                        return;
                    }
                }
            }

            if (response.toolCall) {
                if (this.isStopped) break;
                this.onUpdate({
                    type: 'action',
                    name: response.toolCall.name,
                    args: response.toolCall.args
                });
                const engineNote = await this._describeExecutionEngine(response.toolCall);
                if (engineNote) {
                    this.onUpdate({ type: 'thought', message: engineNote });
                }

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
                if (this.isStopped) break;
                let resultString = this._formatToolResult(result);

                // AUTO-RECOVERY: If a browser interaction fails, automatically scan for elements
                if (response.toolCall.name === 'browserAction' && 
                    ['click', 'clickPixel', 'type', 'keyPress', 'clickText', 'hover'].includes(response.toolCall.args.action) &&
                    (resultString.toLowerCase().includes('error') || resultString.toLowerCase().includes('failed') || resultString.toLowerCase().includes('not found'))) {
                    
                    this.onUpdate({ type: 'thought', message: `⚠️ Action failed. Initiating autonomous 'Auto-Scan' for recovery...` });
                    const recoveryScan = await this.tools.browserAction({ action: 'extractActiveElements' });
                    result = `Original Action Failed: ${resultString}\n\n[AUTO-RECOVERY SCAN DATA]:\n${recoveryScan}\n\nTip: Use the nexus-autoid-X or scan the Markdown to find the correct element for your next attempt.`;
                    resultString = this._formatToolResult(result);
                }

                // PROACTIVE FEEDBACK: If tool result is an error, broadcast it as a thought immediately
                if (resultString.toLowerCase().includes('error') || resultString.toLowerCase().includes('missing')) {
                    this.onUpdate({ type: 'thought', message: `🔍 Workflow Insight: ${resultString}` });
                }

                const truncatedResult = resultString.length > 5000 ? resultString.substring(0, 5000) + '...' : resultString;

                this.onUpdate({ type: 'result', message: truncatedResult });

                // Add result back to context
                this.context.push({ role: 'tool', name: response.toolCall.name, content: result });

                if (await this._handleToolRequirement(response.toolCall, resultString)) {
                    this.isWaitingForInput = true;
                    this._finishRun('paused');
                    return;
                }
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

        // Close browser after finished missions, or when explicitly requested.
        const requestToCheck = originalRequest || (this.context.find(m => m.role === 'user')?.content || "");
        const usedBrowser = Boolean(this.currentRun?.toolsUsed?.browserAction);
        const shouldClose = !this.isWaitingForInput && (usedBrowser || /auto[- ]?close(d)?/i.test(requestToCheck));
        if (shouldClose) {
            this.onUpdate({ type: 'step', message: 'Auto-closing browser as requested...' });
            await this.browserInstance.close();
        }
    }

    async dispatchTool(toolCall) {
        return this._dispatchTool(toolCall, {});
    }

    _normalizeToolCall(toolCall = {}) {
        const browserActionAliases = new Set([
            'open',
            'click',
            'clickPixel',
            'clickText',
            'type',
            'clearAndType',
            'focus',
            'keyPress',
            'hover',
            'scroll',
            'extract',
            'extractActiveElements',
            'getMarkdown',
            'screenshot',
            'waitForNetworkIdle',
            'waitForSelector'
        ]);

        if (browserActionAliases.has(toolCall.name)) {
            return {
                name: 'browserAction',
                args: {
                    ...(toolCall.args || {}),
                    action: toolCall.name
                }
            };
        }

        if (toolCall.name === 'browserAction') {
            return {
                ...toolCall,
                args: { ...(toolCall.args || {}) }
            };
        }

        if (toolCall.name === 'metaAds') {
            const normalizedArgs = { ...(toolCall.args || {}) };
            if (typeof normalizedArgs.body === 'string' && normalizedArgs.body.trim()) {
                try {
                    const parsedBody = JSON.parse(normalizedArgs.body);
                    if (parsedBody && typeof parsedBody === 'object') {
                        normalizedArgs.message = normalizedArgs.message || parsedBody.message || '';
                        normalizedArgs.link = normalizedArgs.link || parsedBody?.call_to_action?.link || parsedBody.link || '';
                        normalizedArgs.imagePath = normalizedArgs.imagePath || parsedBody.media_url || parsedBody.imagePath || '';
                        normalizedArgs.cta = normalizedArgs.cta || parsedBody?.call_to_action?.type || '';
                        normalizedArgs.title = normalizedArgs.title || parsedBody.title || '';
                        normalizedArgs.pageId = this._isBlankValue(normalizedArgs.pageId) ? (parsedBody.pageId || '') : normalizedArgs.pageId;
                    }
                } catch (_) {}
            }
            return {
                ...toolCall,
                args: normalizedArgs
            };
        }

        if (toolCall.name === 'googleAdsCreateBudget') {
            return { name: 'googleAds', args: { ...(toolCall.args || {}), action: 'createBudget' } };
        }

        if (toolCall.name === 'googleAdsCreateCampaign') {
            return { name: 'googleAds', args: { ...(toolCall.args || {}), action: 'createCampaign' } };
        }

        if (toolCall.name === 'googleAdsCreateAdGroup') {
            return { name: 'googleAds', args: { ...(toolCall.args || {}), action: 'createAdGroup' } };
        }

        if (toolCall.name === 'googleAdsAddKeywords') {
            return { name: 'googleAds', args: { ...(toolCall.args || {}), action: 'addKeywords' } };
        }

        if (toolCall.name === 'googleAdsCreateResponsiveSearchAd') {
            return { name: 'googleAds', args: { ...(toolCall.args || {}), action: 'createResponsiveSearchAd' } };
        }

        if (toolCall.name === 'googleAdsListCampaigns') {
            return { name: 'googleAds', args: { ...(toolCall.args || {}), action: 'listCampaigns' } };
        }

        if (toolCall.name === 'linkedinPublishPost') {
            return { name: 'linkedinAds', args: { ...(toolCall.args || {}), action: 'publishPost' } };
        }

        return toolCall;
    }

    _isBlankValue(value) {
        const normalized = String(value ?? '').trim().toLowerCase();
        return !normalized || ['null', 'undefined', 'none', 'n/a', 'na'].includes(normalized);
    }

    _validateMetaOrganicArgs(args = {}) {
        const action = String(args.action || '');
        if (!['publishOrganicPost', 'publishOrganicPhoto', 'publishOrganicVideo', 'publishOrganicReel'].includes(action)) {
            return null;
        }

        const missing = [];
        const pageIdMissing = this._isBlankValue(args.pageId);
        if (pageIdMissing) missing.push('pageId');

        if (action === 'publishOrganicPost' || action === 'publishOrganicPhoto') {
            const messageMissing = this._isBlankValue(args.message);
            const imagePathMissing = this._isBlankValue(args.imagePath) && this._isBlankValue(this.lastUploadedFile);
            const linkMissing = this._isBlankValue(args.link);
            const requestedChannels = Array.isArray(args.channels) ? args.channels.map((item) => String(item || '').toLowerCase()) : [];
            if (messageMissing) missing.push('message');
            if (imagePathMissing && linkMissing) missing.push('imagePath or link');
            if (requestedChannels.includes('instagram') && imagePathMissing) missing.push('imagePath');
        }

        if (action === 'publishOrganicPhoto' && this._isBlankValue(args.imagePath) && this._isBlankValue(this.lastUploadedFile)) {
            if (!missing.includes('imagePath')) missing.push('imagePath');
        }

        if (action === 'publishOrganicVideo' || action === 'publishOrganicReel') {
            if (this._isBlankValue(args.videoPath)) missing.push('videoPath');
            if (action === 'publishOrganicVideo' && this._isBlankValue(args.title)) missing.push('title');
            if (this._isBlankValue(args.description)) missing.push('description');
        }

        if (!missing.length) return null;
        return `Organic Meta publish is missing required fields: ${missing.join(', ')}. Prepare the real post payload first, then ask for Boss approval.`;
    }

    _isMetaOrganicPublishAction(toolCall = {}) {
        return toolCall?.name === 'metaAds' &&
            ['publishOrganicPost', 'publishOrganicPhoto', 'publishOrganicVideo', 'publishOrganicReel'].includes(String(toolCall?.args?.action || ''));
    }

    _isSuccessfulMetaPublishResult(result) {
        if (!result || typeof result !== 'object') return false;
        if (result.error) return false;
        return Boolean(result.id || result.post_id || result.success === true);
    }

    _isMetaAuthError(result) {
        if (!result || typeof result !== 'object') return false;
        const code = Number(result?.details?.code || 0);
        const subcode = Number(result?.details?.error_subcode || 0);
        const message = String(result?.error || result?.details?.message || '').toLowerCase();
        return code === 190 || subcode === 463 || message.includes('access token') || message.includes('oauth');
    }

    _isExternalActionConfirmed(name, result) {
        if (!name) return false;
        if (name === 'metaAds') return this._isSuccessfulMetaPublishResult(result);
        if (name === 'linkedinPublishPost') {
            return Boolean(result && typeof result === 'object' && (result.success === true || result.id));
        }
        if (['googleAdsCreateCampaign', 'googleAdsCreateBudget', 'googleAdsCreateAdGroup', 'googleAdsAddKeywords', 'googleAdsCreateResponsiveSearchAd'].includes(name)) {
            if (Array.isArray(result) && result.length > 0) return true;
            return Boolean(result && typeof result === 'object' && (result.resource_name || result.id || result.success === true));
        }
        if (name === 'sendEmail' || name === 'sendWhatsApp' || name === 'sendWhatsAppMedia') {
            const serialized = typeof result === 'string' ? result.toLowerCase() : JSON.stringify(result || {}).toLowerCase();
            return !serialized.startsWith('error') && !serialized.includes('"error"');
        }
        return true;
    }

    async _preflightExternalAction(toolCall = {}) {
        const { name, args = {} } = toolCall;
        if (name === 'metaAds') {
            const status = await MetaAdsTool.getSetupStatus();
            const action = String(args.action || '');
            const needsPaidSetup = ['createCampaign', 'createAdSet', 'createAdCreative', 'createAd', 'uploadImage', 'getAccountInfo'].includes(action);
            const needsOrganicSetup = ['publishOrganicPost', 'publishOrganicPhoto', 'publishOrganicVideo', 'publishOrganicReel', 'getPageInsights'].includes(action);
            const requestedChannels = Array.isArray(args.channels) ? args.channels.map((item) => String(item || '').trim().toLowerCase()) : [];
            const missing = [];
            if (!status.hasAccessToken) missing.push('META_ACCESS_TOKEN');
            if (needsPaidSetup && !status.hasAdAccountId) missing.push('META_AD_ACCOUNT_ID');
            if (needsOrganicSetup && !status.hasPageId) missing.push('META_PAGE_ID');
            if (requestedChannels.includes('instagram') && !status.hasInstagramBusinessAccountId) missing.push('INSTAGRAM_BUSINESS_ACCOUNT_ID');
            if (missing.length) {
                return {
                    ok: false,
                    error: `Meta action ${action} is blocked by missing setup: ${missing.join(', ')}.`,
                    missingKeys: missing,
                    provider: 'meta'
                };
            }
            return { ok: true };
        }

        if (name === 'googleAds' || ['googleAdsCreateCampaign', 'googleAdsCreateBudget', 'googleAdsCreateAdGroup', 'googleAdsAddKeywords', 'googleAdsCreateResponsiveSearchAd', 'googleAdsListCampaigns'].includes(name)) {
            const status = await GoogleAdsTool.getSetupStatus();
            const missing = [];
            if (!status.hasClientId) missing.push('GOOGLE_ADS_CLIENT_ID');
            if (!status.hasClientSecret) missing.push('GOOGLE_ADS_CLIENT_SECRET');
            if (!status.hasDeveloperToken) missing.push('GOOGLE_ADS_DEVELOPER_TOKEN');
            if (!status.hasRefreshToken) missing.push('GOOGLE_ADS_REFRESH_TOKEN');
            if (missing.length) {
                return {
                    ok: false,
                    error: `Google Ads action ${args.action || name} is blocked by missing setup: ${missing.join(', ')}.`,
                    missingKeys: missing,
                    provider: 'google_ads'
                };
            }
            return { ok: true };
        }

        if (name === 'linkedinAds' || name === 'linkedinPublishPost') {
            const status = await LinkedInAdsTool.getSetupStatus();
            if (!status.hasAccessToken) {
                return {
                    ok: false,
                    error: 'LinkedIn publish is blocked by missing setup: LINKEDIN_ACCESS_TOKEN.',
                    missingKeys: ['LINKEDIN_ACCESS_TOKEN'],
                    provider: 'linkedin'
                };
            }
            return { ok: true };
        }

        return { ok: true };
    }

    _formatMetaPublishSuccess(result, draft = null) {
        const postId = result?.id || result?.post_id || 'unknown';
        const lines = [
            'Organic Meta post published successfully.',
            `Post ID: ${postId}`,
            draft?.title ? `Title: ${draft.title}` : '',
            draft?.ctaLabel ? `CTA: ${draft.ctaLabel}` : '',
            draft?.link ? `Link: ${draft.link}` : ''
        ].filter(Boolean);
        return lines.join('\n');
    }

    async _runMetaAdsAction(args = {}) {
        const action = String(args.action || '');
        switch (action) {
            case 'createCampaign':
                return await MetaAdsTool.createCampaign(args.name, args.objective);
            case 'createAdSet':
                return await MetaAdsTool.createAdSet(args.campaignId, args.name, args.budget || 1000, args.targeting);
            case 'createAdCreative':
                return await MetaAdsTool.createAdCreative(args.name, args.title, args.body, args.imageHash || args.imageUrl, args.pageId, args.cta, args.link);
            case 'createAd':
                return await MetaAdsTool.createAd(args.adSetId, args.creativeId, args.name);
            case 'publishOrganicPost':
                return await MetaAdsTool.publishOrganicPostSurfaces({
                    pageId: args.pageId,
                    message: args.message,
                    link: args.link,
                    imagePath: args.imagePath || this.lastUploadedFile,
                    channels: args.channels || ['facebook']
                });
            case 'publishOrganicPhoto':
                return await MetaAdsTool.publishPagePhoto(args.pageId, args.message, args.imagePath || this.lastUploadedFile);
            case 'publishOrganicVideo':
                return await MetaAdsTool.publishPageVideo(args.pageId, args.title, args.description, args.videoPath);
            case 'publishOrganicReel':
                return await MetaAdsTool.publishPageReel(args.pageId, args.description, args.videoPath);
            case 'getPageInsights':
                return await MetaAdsTool.getPageInsights(args.pageId);
            case 'getAccountInfo':
                return await MetaAdsTool.getAccountInfo();
            case 'uploadImage':
                return await MetaAdsTool.uploadImage(args.imagePath);
            case 'metaGetComments':
                return await MetaAdsTool.getComments(args.objectId);
            case 'metaSetCredentials':
                return await MetaAdsTool.setCredentials(args.accessToken, args.adAccountId, args.pageId);
            case 'metaReplyToComment':
                return await MetaAdsTool.replyToComment(args.commentId, args.message);
            default:
                return `Unknown metaAds action: ${action}`;
        }
    }

    async _runGoogleAdsAction(args = {}) {
        const action = String(args.action || '');
        switch (action) {
            case 'listCampaigns':
                return await GoogleAdsTool.listCampaigns(args.customerId);
            case 'createBudget':
                return await GoogleAdsTool.createCampaignBudget(args.customerId, args.name, args.amountMicros, args.deliveryMethod);
            case 'createCampaign':
                return await GoogleAdsTool.createCampaign(args.customerId, args.campaignData);
            case 'createAdGroup':
                return await GoogleAdsTool.createAdGroup(args.customerId, args.adGroupData);
            case 'addKeywords':
                return await GoogleAdsTool.addKeywords(args.customerId, args.adGroupResourceName, args.keywords);
            case 'createResponsiveSearchAd':
                return await GoogleAdsTool.createResponsiveSearchAd(args.customerId, args.adData);
            default:
                return `Unknown googleAds action: ${action}`;
        }
    }

    async _runLinkedInAdsAction(args = {}) {
        const action = String(args.action || '');
        switch (action) {
            case 'publishPost':
                return await LinkedInAdsTool.publishOrganicPost(args.urn, args.text, args.imagePath || this.lastUploadedFile || null);
            default:
                return `Unknown linkedinAds action: ${action}`;
        }
    }

    async _dispatchTool(toolCall, options = {}) {
        const normalizedToolCall = this._normalizeToolCall(toolCall);
        const { name, args } = normalizedToolCall;
        
        if (this.currentRun) {
            this.currentRun.toolCalls += 1;
            this.currentRun.lastTool = name;
            this.currentRun.toolsUsed[name] = (this.currentRun.toolsUsed[name] || 0) + 1;
        }

        try {
            const preflight = await this._preflightExternalAction(normalizedToolCall);
            if (!preflight.ok) return preflight;

            const governance = GovernanceService.evaluate(normalizedToolCall);
            if (!options.skipGovernance && governance.requiresApproval && args?.boss_approved !== true) {
                this.pendingApproval = {
                    requestedAt: new Date().toISOString(),
                    toolCall: normalizedToolCall,
                    reason: governance.reason,
                    preview: governance.preview,
                    details: governance.details || null
                };
                this.onUpdate({
                    type: 'approval_requested',
                    message: `Approval required for ${name}. ${governance.reason}\n\nPreview:\n${governance.preview}\n\nReply YES to approve.`
                });
                this.isWaitingForInput = true;
                return `APPROVAL REQUIRED: ${governance.reason}\n${governance.preview}`;
            }

            if (governance.requiresApproval && (options.skipGovernance || args?.boss_approved === true)) {
                this._recordAudit('external_action_executed', { tool: name, preview: governance.preview });
            }

            // --- DISPATCHER ---

            // A. Special Handler: Browser Action
            if (name === 'browserAction') {
                const normalizedBrowserArgs = { ...(args || {}) };
                if (!String(normalizedBrowserArgs.action || '').trim()) normalizedBrowserArgs.action = normalizedBrowserArgs.url ? 'open' : 'getMarkdown';
                const result = await this.tools.browserAction(normalizedBrowserArgs);
                const visualActions = ['open', 'click', 'clickPixel', 'type', 'keyPress', 'clickText', 'scroll', 'hover'];
                if (visualActions.includes(normalizedBrowserArgs.action) && this.taskDir) {
                    const screenshotName = `screenshot_${Date.now()}.png`;
                    const screenshotPath = require('path').join(this.taskDir, screenshotName);
                    await this.tools.browserAction({ action: 'annotateAndScreenshot', savePath: screenshotPath });
                    const folderName = require('path').basename(this.taskDir);
                    this.onUpdate({ type: 'thought', message: `🖼️ **Browser Update:**\n![Browser View](/outputs/${folderName}/${screenshotName})` });
                }
                return result;
            }

            // B. Special Handler: Ads
            if (['metaAds', 'googleAds', 'linkedinAds'].includes(name)) {
                if (name === 'metaAds') {
                    const dangerous = ['createCampaign', 'createAdSet', 'createAdCreative', 'createAd', 'publishOrganicPost', 'publishOrganicPhoto', 'publishOrganicVideo', 'publishOrganicReel'];
                    if (dangerous.includes(args.action) && args.boss_approved !== true) return "⚠️ MISSION BREACH: Dangerous action attempted without approval.";
                }
                return await this.tools[name](args);
            }

            // C. Special Handler: Generative Media
            if (name === 'generateImage') {
                const result = await ImageGenTool.generateImage(args.prompt, args.savePath);
                if (!String(result).toLowerCase().startsWith('error')) await this._recordMediaUsage('Gemini', 'imagen-4.0-generate-001', 'free', 0);
                return result;
            }

            if (name === 'generateVideo') {
                if (args.prompt && !args.imagePath) {
                    const veo = await VideoGenTool.generateWithVeo(args.prompt, args.outputPath);
                    if (!veo.error) return `SUCCESS: Video created via Veo at ${args.outputPath}`;
                    const repl = await VideoGenTool.generateFromPrompt(args.prompt, args.outputPath);
                    if (!repl.error) return `SUCCESS: Video created via Replicate at ${args.outputPath}`;
                }
                return await VideoGenTool.imageToVideo(args.imagePath, args.outputPath);
            }

            // D. Dynamic Generic Tools (File, Memory, Skills, Search)
            if (this.tools[name]) {
                try {
                    return await this.tools[name](args);
                } catch (e) {
                    console.warn(`[Dispatcher] Legacy fallback for ${name}: ${e.message}`);
                    if (name === 'readFile') return await this.tools.readFile(args.absolutePath);
                    if (name === 'writeFile') return await this.tools.writeFile(args.absolutePath, args.content);
                    if (name === 'saveMemory') return await this.tools.saveMemory(args.content, args.category);
                    if (name === 'runCommand') return await this.tools.runCommand(args.command, args.cwd);
                    throw e;
                }
            }

            // E. Final Fallback
            switch (name) {
                case 'buildAgencyQuotePlan': return AgencyQuotePlanner.buildPlan(args);
                case 'createAgencyQuoteArtifacts': return await this._createAgencyQuoteArtifacts(args);
                default: return `Error: Tool '${name}' not found in orchestrator mapping.`;
            }
        } catch (error) {
            if (this.currentRun) {
                this.currentRun.errorCount += 1;
                this.currentRun.lastError = error.message;
            }
            return `Error executing tool: ${error.message}`;
        }
    }

    async _runChatLoop(originalRequest = null) {
        if (this.currentRun) this.currentRun.llmCalls += 1;
        const response = await this.llmService.generateResponse(this.context, { mode: 'chat', enableTools: false });
        if (this.isStopped) return;

        if (this.currentRun) {
            if (response.provider) this.currentRun.lastLlmProvider = response.provider;
            if (response.model) this.currentRun.lastLlmModel = response.model;
            const usage = response.usage || {};
            const usageEvent = await UsageTracker.recordLlmUsage({
                provider: response.provider,
                model: response.model,
                clientId: this.currentClientId || null,
                sessionId: this.currentSessionId || null,
                runId: this.currentRun.id,
                requestPreview: this.currentRun.requestPreview,
                mode: 'chat',
                inputTokens: usage.inputTokens || 0,
                outputTokens: usage.outputTokens || 0,
                totalTokens: usage.totalTokens || 0
            });
            const usageKey = `${usageEvent.provider}::${usageEvent.model}`;
            const currentEntry = this.currentRun.providerUsage?.[usageKey] || {
                provider: usageEvent.provider,
                model: usageEvent.model,
                calls: 0,
                freeCalls: 0,
                paidCalls: 0,
                estimatedCostUsd: 0,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0
            };
            currentEntry.calls += 1;
            currentEntry.freeCalls += usageEvent.usageTier === 'free' ? 1 : 0;
            currentEntry.paidCalls += usageEvent.usageTier === 'paid' ? 1 : 0;
            currentEntry.estimatedCostUsd = Number((currentEntry.estimatedCostUsd + Number(usageEvent.estimatedCostUsd || 0)).toFixed(6));
            currentEntry.inputTokens += Number(usageEvent.inputTokens || 0);
            currentEntry.outputTokens += Number(usageEvent.outputTokens || 0);
            currentEntry.totalTokens += Number(usageEvent.totalTokens || 0);
            this.currentRun.providerUsage = this.currentRun.providerUsage || {};
            this.currentRun.providerUsage[usageKey] = currentEntry;
        }

        const text = String(response.text || '').trim() || 'No response generated.';
        this.onUpdate({ type: 'thought', message: text });
        this.context.push({ role: 'assistant', content: text });

        const textLower = text.toLowerCase();
        const isAskingQuestion = textLower.includes('?') ||
            textLower.includes('please provide') ||
            textLower.includes('i need your') ||
            textLower.includes('tell me');

        if (isAskingQuestion) {
            this.onUpdate({ type: 'pause' });
            this.isWaitingForInput = true;
            this._finishRun('paused');
            return;
        }

        this.onUpdate({ type: 'complete', message: 'Chat response complete.' });
        this._finishRun('completed');
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
            if (pending.details?.requestedMode) {
                this.currentMissionMode = String(pending.details.requestedMode).toLowerCase();
                this.onUpdate({ type: 'thought', message: `Boss approved ${this.currentMissionMode.toUpperCase()} mode. Nexus is continuing.` });
            }
            this._recordAudit('approval_granted', { tool: approvedCall.name, preview: pending.preview });
            this.context.push({ role: 'user', content: `Approval granted by user: ${userInput}` });
            this.context.push({ role: 'assistant', content: '', toolCall: approvedCall });
            this.onUpdate({ type: 'action', name: approvedCall.name, args: approvedCall.args });
            this.pendingApproval = null;
            if (approvedCall.name === 'metaAds' && String(approvedCall.args?.action || '').startsWith('publishOrganic')) {
                this._setWorkflowState({
                    domain: 'marketing',
                    channel: 'meta',
                    mode: 'organic_publish',
                    stage: 'publishing'
                });
            }
            const result = await this._dispatchTool(approvedCall, { skipGovernance: true });
            this.onUpdate({ type: 'result', message: this._formatToolResult(result).slice(0, 5000) });
            this.context.push({ role: 'tool', name: approvedCall.name, content: result });
            if (this._isMetaOrganicPublishAction(approvedCall)) {
                if (this._isSuccessfulMetaPublishResult(result)) {
                    this._setWorkflowState({
                        domain: 'marketing',
                        channel: 'meta',
                        mode: 'organic_publish',
                        stage: 'published'
                    });
                    this.onUpdate({ type: 'complete', message: this._formatMetaPublishSuccess(result, this.currentOrganicMetaDraft) });
                    this._finishRun('completed');
                    return;
                }
                this._setWorkflowState({
                    domain: 'marketing',
                    channel: 'meta',
                    mode: 'organic_publish',
                    stage: 'publish_failed'
                });
                if (this._isMetaAuthError(result)) {
                    this.pendingRequirement = {
                        requestedAt: new Date().toISOString(),
                        toolCall: approvedCall,
                        keys: ['META_ACCESS_TOKEN']
                    };
                    this.onUpdate({
                        type: 'input_requested',
                        message: 'Meta publish failed because the Meta access token is expired or invalid. Reply with a fresh META_ACCESS_TOKEN (or update settings) and Nexus will continue.'
                    });
                    this.isWaitingForInput = true;
                    this._finishRun('paused');
                    return;
                }
                this.onUpdate({ type: 'error', message: `Organic Meta publish failed.\n${this._formatToolResult(result).slice(0, 5000)}` });
                this.isWaitingForInput = true;
                this._finishRun('paused');
                return;
            }
            if (!this._isExternalActionConfirmed(approvedCall.name, result)) {
                this.onUpdate({ type: 'error', message: `${approvedCall.name} did not return a confirmed success response.\n${this._formatToolResult(result).slice(0, 5000)}` });
                this.isWaitingForInput = true;
                this._finishRun('paused');
                return;
            }
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
        await MemoryService.saveRecoveryPattern({
            tool: toolCall.name,
            classification: classification.type,
            summary: classification.summary,
            playbook: playbook?.strategy || null,
            resolution: 'Detected automatically during live self-healing flow'
        });

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

        if (playbook.strategy === 'analyze_and_patch') {
            const toolName = toolCall.name;
            this.onUpdate({ type: 'thought', message: `🔍 Sovereign Protocol: A logic error was detected in tool [${toolName}]. Searching Fix Library...` });
            
            // 1. First, search the Fix Library for proven solutions
            const blueprints = await MemoryService.findFixBlueprints(toolName, classification.type);
            let blueprintContext = "";
            if (blueprints && blueprints.length > 0) {
                this.onUpdate({ type: 'thought', message: `📚 Fix Library: Found ${blueprints.length} proven solution(s) for [${toolName}].` });
                blueprintContext = `### PROVEN FIX BLUEPRINTS FOUND:
${blueprints.map((b, idx) => `[Blueprint ${idx + 1}]: ${b.description}\nSuggested Patch:\n${b.patch}`).join('\n\n')}

INSTRUCTION: A proven fix exists for this error. Use 'replaceFileContent' to apply the most relevant blueprint above, then retry.
\n`;
            }

            // 2. Map tool names to filenames
            let toolFileName = `${toolName}.js`;
            if (toolName === 'browserAction') toolFileName = 'browser.js';
            if (toolName === 'readFile' || toolName === 'writeFile' || toolName === 'listDir' || toolName === 'replaceFileContent') toolFileName = 'fileSystem.js';
            
            const toolFile = path.join(__dirname, 'tools', toolFileName);
            if (fs.existsSync(toolFile)) {
                const toolSource = fs.readFileSync(toolFile, 'utf8');
                this.context.push({ 
                    role: 'tool', 
                    name: toolName, 
                    content: `[SYSTEM DIAGNOSTIC] A logic/path error occurred.
${blueprintContext}
SOVEREIGN ENGINEERING PROTOCOL ACTIVATED:
1. Analyze the tool source below.
2. If no blueprint above fits, identify the root cause and apply a new precision fix.
3. CRITICAL: If you create a NEW fix, you MUST also use 'saveMemory' to store a 'Fix Blueprint' with a clear description so this can be used later.

TOOL SOURCE [${toolFileName}]:
${toolSource}` 
                });
                return;
            }
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

    _detectMissingKeys(resultString) {
        const text = String(resultString || '');
        const directKeys = Array.from(new Set((text.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || []).filter((key) => key.includes('_'))));
        if (directKeys.length) return directKeys;

        const inferred = [];
        const lower = text.toLowerCase();
        if (lower.includes('meta api token missing') || lower.includes('meta access token')) inferred.push('META_ACCESS_TOKEN');
        if (lower.includes('missing page id')) inferred.push('META_PAGE_ID');
        if (lower.includes('gmail credentials')) inferred.push('GMAIL_USER', 'GMAIL_APP_PASSWORD');
        if (lower.includes('whatsapp credentials')) inferred.push('META_ACCESS_TOKEN', 'WHATSAPP_PHONE_ID');
        if (lower.includes('linkedin_access_token') || lower.includes('linkedin access token')) inferred.push('LINKEDIN_ACCESS_TOKEN');
        if (lower.includes('openrouter_api_token')) inferred.push('OPENROUTER_API_TOKEN');
        if (lower.includes('replicate_api_token')) inferred.push('REPLICATE_API_TOKEN');
        if (lower.includes('brave_search_api_key')) inferred.push('BRAVE_SEARCH_API_KEY');
        return Array.from(new Set(inferred));
    }

    async _handleToolRequirement(toolCall, resultString) {
        const text = String(resultString || '');
        const lower = text.toLowerCase();
        if (!(lower.includes('missing') || lower.includes('not configured') || lower.includes('not initialized'))) return false;

        const keys = this._detectMissingKeys(text);
        if (!keys.length) return false;

        this.pendingRequirement = {
            requestedAt: new Date().toISOString(),
            toolCall,
            keys
        };
        const keyMessage = keys.length === 1
            ? `Reply with the value for ${keys[0]} and Nexus will save it and continue.`
            : `Reply using KEY=value lines for these settings: ${keys.join(', ')}. Nexus will save them and continue.`;
        this.onUpdate({
            type: 'input_requested',
            message: `Mission is blocked by missing configuration for ${toolCall.name}: ${keys.join(', ')}.\n\n${keyMessage}`
        });
        return true;
    }

    async _saveRequirementValues(values) {
        if (!db) throw new Error('Firebase is not initialized.');
        const collection = this.currentClientId ? 'client_configs' : 'configs';
        const docId = this.currentClientId || 'default';
        await db.collection(collection).doc(docId).set(values, { merge: true });
        require('./core/config').refresh();
    }

    async _handleRequirementResponse(userInput) {
        const pending = this.pendingRequirement;
        const trimmed = String(userInput || '').trim();
        if (!trimmed) {
            this.onUpdate({ type: 'input_requested', message: `Still waiting for ${pending.keys.join(', ')}.` });
            return;
        }

        const normalized = trimmed.toLowerCase();
        if (/^(cancel|stop|skip|no)\b/.test(normalized)) {
            this.pendingRequirement = null;
            this.context.push({ role: 'user', content: `Boss cancelled the missing configuration step for ${pending.keys.join(', ')}.` });
            this.onUpdate({ type: 'thought', message: `Configuration step cancelled by the Boss. Mission will continue without saving new keys.` });
            await this.resume('The Boss cancelled the configuration request. Continue the mission without requesting those settings again unless absolutely necessary.');
            return;
        }

        if (/^use (saved|configured|existing)/.test(normalized)) {
            const ConfigService = require('./core/config');
            const existingValues = {};
            for (const key of pending.keys) {
                const value = await ConfigService.get(key);
                if (value) existingValues[key] = value;
            }
            const stillMissing = pending.keys.filter((key) => !existingValues[key]);
            if (!stillMissing.length) {
                this._recordAudit('requirement_reused', { keys: pending.keys, tool: pending.toolCall.name });
                this.context.push({ role: 'user', content: `Boss instructed Nexus to use the existing saved configuration for ${pending.keys.join(', ')}.` });
                this.pendingRequirement = null;
                this.onUpdate({ type: 'thought', message: `Using the saved configuration for ${pending.keys.join(', ')} and resuming the mission.` });
                await this.resume('Use the existing saved configuration and continue the current mission without asking again.');
                return;
            }
            this.onUpdate({ type: 'input_requested', message: `I checked the saved settings and still need: ${stillMissing.join(', ')}.` });
            return;
        }

        let values = {};
        if (pending.keys.length === 1 && !trimmed.includes('=')) {
            values[pending.keys[0]] = trimmed;
        } else {
            const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
            for (const line of lines) {
                const idx = line.indexOf('=');
                if (idx > 0) {
                    const key = line.slice(0, idx).trim();
                    const value = line.slice(idx + 1).trim();
                    if (key && value) values[key] = value;
                }
            }
        }

        const missingStill = pending.keys.filter((key) => !values[key]);
        if (missingStill.length) {
            this.onUpdate({ type: 'input_requested', message: `I still need: ${missingStill.join(', ')}. Please reply with ${missingStill.length === 1 ? 'the value' : 'KEY=value lines'}.` });
            return;
        }

        await this._saveRequirementValues(values);
        this._recordAudit('requirement_saved', { keys: pending.keys, tool: pending.toolCall.name });
        this.context.push({ role: 'user', content: `Boss supplied required configuration for ${pending.keys.join(', ')}. Continue the current mission.` });
        this.pendingRequirement = null;
        this.onUpdate({ type: 'thought', message: `Saved ${Object.keys(values).join(', ')} and resuming the mission.` });
        await this.resume('Required configuration has been saved. Continue the current mission without restarting it.');
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
            lastLlmProvider: null,
            lastLlmModel: null,
            providerUsage: {},
            providerSwitches: [],
            steps: 0,
            clientId: this.currentClientId || null,
            estimatedCostUsd: 0,
            mode: this.currentMissionMode,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0
        };
    }

    _finishRun(status) {
        if (!this.currentRun || this.currentRun.finishedAt) return;
        this.currentRun.finishedAt = new Date().toISOString();
        this.currentRun.status = status;
        this.currentRun.steps = this.stepCount;
        const providerCostUsd = Object.values(this.currentRun.providerUsage || {}).reduce((sum, entry) => sum + Number(entry.estimatedCostUsd || 0), 0);
        this.currentRun.inputTokens = Object.values(this.currentRun.providerUsage || {}).reduce((sum, entry) => sum + Number(entry.inputTokens || 0), 0);
        this.currentRun.outputTokens = Object.values(this.currentRun.providerUsage || {}).reduce((sum, entry) => sum + Number(entry.outputTokens || 0), 0);
        this.currentRun.totalTokens = Object.values(this.currentRun.providerUsage || {}).reduce((sum, entry) => sum + Number(entry.totalTokens || 0), 0);
        const fallbackCostUsd = (this.currentRun.llmCalls * 0.00035) + (this.currentRun.toolCalls * 0.0001);
        this.currentRun.estimatedCostUsd = Number((providerCostUsd > 0 ? providerCostUsd : fallbackCostUsd).toFixed(6));
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
        const totalTokens = completedRuns.reduce((sum, run) => sum + Number(run.totalTokens || 0), 0);

        return {
            activeRun: this.currentRun && !this.currentRun.finishedAt ? { ...this.currentRun, steps: this.stepCount } : null,
            pendingApproval: this.pendingApproval,
            pendingRequirement: this.pendingRequirement,
            pendingRepair: this.pendingRepair,
            missionMode: this.currentMissionMode,
            auditTrail: this.auditTrail.slice(0, 20),
            recoveryHistory: this.recoveryHistory.slice(0, 20),
            recentRuns: allRuns,
            totals: {
                missions: completedRuns.length,
                successRate: completedRuns.length ? Math.round((successRuns.length / completedRuns.length) * 100) : 0,
                paused: pausedRuns.length,
                toolCalls: completedRuns.reduce((sum, run) => sum + (run.toolCalls || 0), 0),
                llmCalls: totalLlmCalls,
                estimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(6)),
                totalTokens
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
            currentMarketingWorkflow: this.currentMarketingWorkflow,
            missionMode: this.currentMissionMode,
            manualMissionMode: this.manualMissionMode,
            isWaitingForInput: this.isWaitingForInput,
            currentRun: this.currentRun,
            recentRuns: this.recentRuns,
            currentOrganicMetaDraft: this.currentOrganicMetaDraft,
            currentWorkflowState: this.currentWorkflowState,
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
        if (state.currentMarketingWorkflow !== undefined) this.currentMarketingWorkflow = state.currentMarketingWorkflow;
        if (state.missionMode !== undefined) this.currentMissionMode = state.missionMode;
        if (state.manualMissionMode !== undefined) this.manualMissionMode = state.manualMissionMode;
        if (state.isWaitingForInput !== undefined) this.isWaitingForInput = state.isWaitingForInput;
        if (state.currentRun) this.currentRun = state.currentRun;
        if (state.recentRuns) this.recentRuns = state.recentRuns;
        if (state.currentOrganicMetaDraft) this.currentOrganicMetaDraft = state.currentOrganicMetaDraft;
        if (state.currentWorkflowState) this.currentWorkflowState = state.currentWorkflowState;
        if (state.pendingApproval) this.pendingApproval = state.pendingApproval;
        if (state.pendingRequirement) this.pendingRequirement = state.pendingRequirement;
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
