const fs = require('fs');
const path = require('path');
const FileSystemTool = require('./tools/fileSystem');
const TerminalTool = require('./tools/terminal');
const BrowserTool = require('./tools/browser');
const ImageGenTool = require('./tools/imageGen');
const SkillGenerator = require('./tools/skillGenerator');
const SkillReaderTool = require('./tools/skillReader');
const N8nDiscoverTool = require('./tools/n8nDiscover');
const MetaAdsTool = require('./tools/metaAds');
const GoogleAdsTool = require('./tools/googleAds');
const LinkedInAdsTool = require('./tools/linkedinAds');
const XAdsTool = require('./tools/xAds');
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
        this.taskDir = taskDir;
        const os = require('os');
        const profileDir = taskDir 
            ? path.join(taskDir, '.browser_profile') 
            : path.join(os.tmpdir(), 'nexus-browser-profiles', this.currentSessionId || 'default');
        
        this.browserInstance = new BrowserTool(profileDir);
        this.skillGen = new SkillGenerator(taskDir ? path.join(taskDir, 'skills') : null);

        this.tools = {
            readFile: (args) => FileSystemTool.readFile(args.absolutePath, this.llmService.readFileState, this.stepCount),
            writeFile: (args) => FileSystemTool.writeFile(args.absolutePath, args.content, this.llmService.readFileState),
            listDir: (args) => FileSystemTool.listDir(args.absolutePath),
            replaceFileContent: (args) => FileSystemTool.replaceFileContent(args.absolutePath, args.startLine, args.endLine, args.targetContent, args.replacementContent, this.llmService.readFileState),
            multiReplaceFileContent: (args) => FileSystemTool.multiReplaceFileContent(args.absolutePath, args.chunks),
            runSed: (args) => FileSystemTool.runSed(args.absolutePath, args.pattern, args.replacement, this.llmService.readFileState),
            runCommand: (args) => TerminalTool.runCommand(args.command, args.cwd, args.runInBackground),
            checkBackgroundTask: (args) => TerminalTool.checkBackgroundTask(args.taskId),
            createWorktree: (args) => require('./tools/worktree').createWorktree(args.taskId, args.branch),
            removeWorktree: (args) => require('./tools/worktree').removeWorktree(args.taskId),
            listWorktrees: () => require('./tools/worktree').listWorktrees(),
            finalizeWorktree: (args) => require('./tools/worktree').finalizeWorktree(args.taskId, args.commitMessage, args.baseBranch),
            browserAction: (args) => this.browserInstance.executeAction(args),
            generateImage: (args) => ImageGenTool.generateImage(args.prompt, args.savePath, { aspectRatio: args.aspectRatio, refine: args.refine }),
            createSkill: (args) => this.skillGen.createSkill(args.name, args.code, args.description),
            listSkills: () => this.skillGen.listSkills(),
            listAgenticSkills: () => SkillReaderTool.listSkills(),
            readAgenticSkill: (args) => SkillReaderTool.readSkill(args.skillName),
            findAgenticSkill: (args) => SkillReaderTool.findBestSkill(args.userIntent),
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
            sendEmail: (args) => EmailTool.sendEmail(args.to, args.subject, args.body, args.attachments || []),
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
            delegateToAgent: (args) => SquadSystem.delegate(args.agentType, args.task),
            xAds: async (args) => this._runXAdsAction(args)
        };
        this.llmService = new LLMService();
        this.maxSteps = 40;
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
        this.pendingClarification = null;
        this.currentSessionId = null;
        this.currentMissionMode = 'execute';
        this.manualMissionMode = null;
        this.currentWorkflowState = null;
        this.currentMissionArtifact = null;
        this.missionArtifactHistory = [];
        this.pendingActionChain = [];
        this.lastPublishedTargets = [];
        this.activeMissionDomain = 'general';
        this.missionTaskStack = [];
        this.isStopped = false;
        this.currentTaskContract = null;
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
        this.pendingClarification = null;
        
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
        this.currentMissionArtifact = null;
        this.missionArtifactHistory = [];
        this.pendingActionChain = [];
        this.lastPublishedTargets = [];
        this.activeMissionDomain = 'general';
        this.missionTaskStack = [];
        this.currentTaskContract = null;
        this.pendingClarification = null;
        this.isStopped = false; // Prepare for next use
        this.onUpdate({ type: 'thought', message: "✨ **System Purge:** All transient mission baggage has been cleared. Ready for fresh sovereign directives." });
    }

    /**
     * Set the current client context, enforcing robust memory isolation
     * and ensuring tool keys map exclusively to the active entity.
     */
    setClientContext(clientId, clientConfig) {
        const ConfigService = require('./core/config');
        ConfigService.setClientOverrides(clientConfig, {
            strict: Boolean(clientId),
            clientId: clientId || null
        });

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
        const isMissionFollowUp = this._isMissionFollowUpRequest(userRequest);
        const augmentedRequest = isMissionFollowUp ? this._augmentFollowUpRequest(userRequest) : userRequest;
        this._beginRun(augmentedRequest);

        if (this._applyWorkflowIntent(augmentedRequest)) {
            this._beginRun(augmentedRequest);
        }

        // CRITICAL FIX: Reset context for a fresh mission to prevent "stale failure" baggage.
        // This ensures the AI starts with a clean slate (System Prompt + New Request).
        this.context = [{ role: 'system', content: this.systemPrompt }];
        this.currentTaskContract = this._buildTaskContract(augmentedRequest);
        if (this.currentTaskContract?.routingProfile) {
            const routing = this.currentTaskContract.routingProfile;
            const preferredTools = Array.isArray(routing.preferredTools) && routing.preferredTools.length
                ? routing.preferredTools.join(', ')
                : 'general reasoning';
            this.onUpdate({
                type: 'thought',
                message: `Task routing locked: domain=${routing.domain || 'general'} | preferred tools=${preferredTools}`
            });
        }
        
        // MISSION STABILITY: Reset transient state for every fresh mission to prevent pollution.
        // If the user isn't explicitly continuing a previous draft, we purge the old baggage.
        if (!this._isOrganicPublishIntent(augmentedRequest)) {
            this.currentOrganicMetaDraft = null;
            this.currentWorkflowState = null;
            this.currentMarketingWorkflow = null;
            this.pendingActionChain = this._inferQueuedActionsFromRequest(augmentedRequest);
            if (!this.pendingActionChain.length && !isMissionFollowUp) {
                this.currentMissionArtifact = null;
                this.missionArtifactHistory = [];
                this.lastPublishedTargets = [];
            }
        }

        const isBrowserMission = this._isBrowserMissionRequest(augmentedRequest);

        // Recall Long-Term Memories
        const memories = isBrowserMission ? [] : await MemoryService.recallRecent(5);
        const recoveryPatterns = isBrowserMission ? [] : await MemoryService.findRecoveryPatterns(augmentedRequest, 3);
        const detectedMarketingWorkflow = isBrowserMission ? null : MarketingService.detectWorkflowFromText(augmentedRequest);
        const detectedGoal = GoalInterpreter.interpretGoal(augmentedRequest);
        const detectedCommercialQuote = this._detectCommercialQuoteRequest(augmentedRequest);
        this.currentMissionMode = MissionMode.detectMissionMode(augmentedRequest, this.manualMissionMode);
        this.currentMarketingWorkflow = detectedMarketingWorkflow ? detectedMarketingWorkflow.id : null;
        let memoryPrompt = "";
        memoryPrompt += MissionMode.buildModePrompt(this.currentMissionMode);
        memoryPrompt += this._buildExecutionProtocol(augmentedRequest);
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
                memoryPrompt += `${MarketingPrompts.buildAdsExecutionContext(augmentedRequest)}\n\n`;
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
            const quoteDefaults = this._extractCommercialQuoteDefaults(augmentedRequest);
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
        // ELITE SOVEREIGNTY: Specialist Role Assumption
        // [RESILIENCE] Only auto-align specialists for non-browser missions to prevent "Proofreader" hijacking of automation.
        const skillSearchRequest = String(userRequest || '');
        const shouldAutoLoadSkill =
            /\b(audit|architecture|refactor|deep|advanced|complex|specialist|expert|strategy|seo|security)\b/i.test(skillSearchRequest) ||
            skillSearchRequest.split(/\s+/).length >= 18;
        const suggestedSkills = shouldAutoLoadSkill ? SkillReaderTool.findBestSkill(userRequest) : [];
        let expertRolePrompt = "";

        if (!isBrowserMission && suggestedSkills.length > 0) {
            const bestSkill = suggestedSkills[0];
            const playbook = SkillReaderTool.readSkill(bestSkill);
            const roleName = bestSkill.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            
            this.onUpdate({ type: 'thought', message: `🧩 **Expert Alignment:** Activating the [${roleName}] specialist persona from standard agency playbook @${bestSkill}.` });
            
            expertRolePrompt = `### EXPERT ROLE ASSUMPTION\nYou are now acting as the **Elite ${roleName} Specialist** for Nexus OS. 
You must strictly adhere to the following expert playbook and Standard Operating Procedures (SOPs):
${playbook}\n\n`;
        }

        const missionDirective = this.currentMissionMode === 'execute' ? 
            "\n\n### MISSION DIRECTIVE\nYou are in EXECUTE mode. Act decisively, but do not rush into unrelated tools. Re-state the exact requested outcome internally, choose only tools that directly advance it, and stop side quests. Your specialist persona is secondary to task relevance and delivery." : "";

        // Inject the active working directory into the prompt if specified
        let executionPrompt = expertRolePrompt + memoryPrompt + augmentedRequest + missionDirective;

        // Push the fully enriched request into context so the LLM sees it
        this.context.push({ role: 'user', content: executionPrompt });

        try {
            // [RESILIENCE] Unified Mission Loop: Resume via the robust execution loop only.
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
        this.pendingClarification = null;
        if (this.pendingApproval) {
            await this._handleApprovalResponse(userInput);
            return;
        }
        if (await this._handleQueuedActionContinuation(userInput)) {
            this.isRunning = true;
            this.isStopped = false;
            this.isWaitingForInput = false;
            try {
                await this._runLoop(null);
                if (this.currentRun && !this.currentRun.finishedAt) {
                    this._finishRun(this.isWaitingForInput ? 'paused' : 'completed');
                }
            } finally {
                this.isRunning = false;
            }
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
            await this._runLoop(null);
            if (this.currentRun && !this.currentRun.finishedAt) {
                this._finishRun(this.isWaitingForInput ? 'paused' : 'completed');
            }
        } finally {
            this.isRunning = false;
        }
    }

    _extractOrganicMetaDraft(text = '') {
        const value = String(text || '');
        const jsonBlock = value.match(/```json\s*([\s\S]*?)```/i)?.[1]?.trim() || '';
        const candidateJson = jsonBlock || value.trim();
        if (candidateJson.startsWith('{')) {
            try {
                const parsed = JSON.parse(candidateJson);
                const platform = String(parsed.platform || '').toLowerCase();
                const type = String(parsed.type || '').toLowerCase();
                const message = String(parsed.message || '').trim();
                const link = String(parsed?.call_to_action?.link || parsed.link || '').trim();
                const imagePath = String(parsed.media_url || parsed.image || '').trim() || null;
                const channels = [];
                if (platform.includes('facebook')) channels.push('facebook');
                if (platform.includes('instagram')) channels.push('instagram');

                if ((platform.includes('facebook') || platform.includes('instagram') || type.includes('organic')) && message && link) {
                    return {
                        channel: 'meta_organic',
                        title: String(parsed.title || '').trim(),
                        description: message,
                        message,
                        cta: /shop now/i.test(String(parsed?.call_to_action?.type || '')) ? 'SHOP_NOW' : 'LEARN_MORE',
                        ctaLabel: String(parsed?.call_to_action?.type || parsed?.call_to_action?.label || 'SHOP NOW').trim() || 'SHOP NOW',
                        link,
                        imagePath,
                        tags: Array.isArray(parsed.hashtags) ? parsed.hashtags.join(' ') : String(parsed.hashtags || '').trim(),
                        channels: channels.length ? channels : ['facebook', 'instagram'],
                        preparedAt: new Date().toISOString()
                    };
                }
            } catch (error) {
                // Fall through to the legacy markdown-style extractor below.
            }
        }

        const hasPromotionContext = /\bfacebook\b|\binstagram\b|\bmeta\b/i.test(value);

        // Support "Proposed Meta Organic Post" drafts that are not in the Title/Description template.
        // Example fields:
        // - Platform: Facebook, Instagram
        // - Media URL: https://...
        // - Message: "..."
        // - Call to Action: Type: SHOP_NOW, Link: https://...
        const proposedBlock = /\bproposed meta organic post\b/i.test(value);
        if (proposedBlock && hasPromotionContext) {
            const platformLine = value.match(/\*\*Platform:\*\*\s*([^\n]+)/i)?.[1]?.trim() || '';
            const mediaUrl = value.match(/\*\*Media URL:\*\*\s*`?(https?:\/\/[^\s`]+)`?/i)?.[1]?.trim() || '';
            const msgBlock = value.match(/\*\*Message:\*\*\s*([\s\S]*?)(?:\n\*\*Call to Action:|\n\*\*Call to Action|\n\*\*Type:|\nDo you approve|\nBoss|\nNexus|$)/i)?.[1]?.trim() || '';
            const ctaType = value.match(/\*\*Type:\*\*\s*([A-Z_]+)/i)?.[1]?.trim() || '';
            const ctaLink = value.match(/\*\*Link:\*\*\s*`?(https?:\/\/[^\s`]+)`?/i)?.[1]?.trim() || '';

            const channels = [];
            const p = platformLine.toLowerCase();
            if (p.includes('facebook') || value.toLowerCase().includes('facebook')) channels.push('facebook');
            if (p.includes('instagram') || value.toLowerCase().includes('instagram')) channels.push('instagram');

            const message = msgBlock.replace(/^["“”]|["“”]$/g, '').trim();
            const link = ctaLink;
            const imagePath = mediaUrl || null;
            if (message && link) {
                return {
                    channel: 'meta_organic',
                    title: '',
                    description: message,
                    message,
                    cta: /shop[_ ]?now/i.test(ctaType) ? 'SHOP_NOW' : 'LEARN_MORE',
                    ctaLabel: ctaType || 'SHOP NOW',
                    link,
                    imagePath,
                    tags: '',
                    channels: channels.length ? channels : ['facebook', 'instagram'],
                    preparedAt: new Date().toISOString()
                };
            }
        }

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
            if (this.currentMissionMode === 'discuss' || this.currentMissionMode === 'marketing' || this.currentMissionMode === 'execute') {
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

        const normalizedDecision = String(userInput || '').trim().toLowerCase();
        const userAlreadyApproved = ['yes', 'y', 'approve', 'approved', 'boss approved'].includes(normalizedDecision);

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

        // If the user already said "approved/yes", treat it as the approval response and execute immediately.
        if (userAlreadyApproved) {
            await this._handleApprovalResponse('YES');
        }
        return true;
    }

    _inferQueuedActionsFromRequest(userRequest = '') {
        const value = String(userRequest || '').toLowerCase();
        const actions = [];
        this.pendingActionChain = Array.isArray(this.pendingActionChain) ? this.pendingActionChain : [];

        const wantsImage = /\b(generate|create|design|make)\b/.test(value) && /\bimage|poster|banner|creative|thumbnail|logo\b/.test(value);
        const wantsVideo = /\b(generate|create|make)\b/.test(value) && /\bvideo|reel|short|promo video\b/.test(value);
        const wantsQuote = /\b(quote|quotation|proposal|estimate|pricing)\b/.test(value);
        const wantsContent = /\b(write|draft|create)\b/.test(value) && /\bcontent|caption|post copy|copy|article|blog|linkedin post\b/.test(value);
        const wantsMetaPromote = /\b(promote|publish|post|boost|run)\b/.test(value) && /\bfacebook|instagram|meta\b/.test(value);
        const wantsLinkedInPublish = /\b(post|publish)\b/.test(value) && /\blinkedin\b/.test(value);
        const wantsXPublish = /\b(post|publish|tweet)\b/.test(value) && /\bx\b|\btwitter\b/.test(value);
        const wantsEmailSend = /\b(send|mail|email|share)\b/.test(value) && /\bemail\b/.test(value);
        const wantsWhatsAppSend = /\b(send|share)\b/.test(value) && /\bwhatsapp\b/.test(value);

        if (wantsImage && wantsMetaPromote) {
            actions.push({
                id: `queued_${Date.now()}_meta_image`,
                type: 'promote_generated_asset',
                channel: 'meta',
                status: 'pending_confirmation',
                createdAt: new Date().toISOString(),
                prompt: 'Use the latest approved generated image and prepare the Facebook/Instagram promotion flow.'
            });
        }

        if (wantsVideo && (wantsMetaPromote || wantsLinkedInPublish || wantsXPublish)) {
            actions.push({
                id: `queued_${Date.now()}_video_publish`,
                type: 'publish_generated_video',
                channel: wantsLinkedInPublish ? 'linkedin' : wantsXPublish ? 'x' : 'meta',
                status: 'pending_confirmation',
                createdAt: new Date().toISOString(),
                prompt: 'Use the latest approved generated video and prepare the requested publish flow on the target platform.'
            });
        }

        if (wantsContent && wantsLinkedInPublish) {
            actions.push({
                id: `queued_${Date.now()}_linkedin_content`,
                type: 'publish_written_content',
                channel: 'linkedin',
                status: 'pending_confirmation',
                createdAt: new Date().toISOString(),
                prompt: 'Use the approved written content and prepare the LinkedIn publishing step.'
            });
        }

        if (wantsContent && wantsXPublish) {
            actions.push({
                id: `queued_${Date.now()}_x_content`,
                type: 'publish_written_content',
                channel: 'x',
                status: 'pending_confirmation',
                createdAt: new Date().toISOString(),
                prompt: 'Use the approved written content and prepare the X publishing step.'
            });
        }

        if (wantsQuote && wantsEmailSend) {
            actions.push({
                id: `queued_${Date.now()}_quote_email`,
                type: 'send_quote_bundle',
                channel: 'email',
                status: 'pending_confirmation',
                createdAt: new Date().toISOString(),
                prompt: 'Use the latest approved quotation bundle and prepare the email handoff to the intended recipient.'
            });
        }

        if (wantsQuote && wantsWhatsAppSend) {
            actions.push({
                id: `queued_${Date.now()}_quote_whatsapp`,
                type: 'share_quote_bundle',
                channel: 'whatsapp',
                status: 'pending_confirmation',
                createdAt: new Date().toISOString(),
                prompt: 'Use the latest approved quotation bundle and prepare the WhatsApp handoff to the intended recipient.'
            });
        }

        return actions;
    }

    _isMissionFollowUpRequest(text = '') {
        const value = String(text || '').trim().toLowerCase();
        if (!value) return false;
        const hasMemory = Boolean(
            this.currentMissionArtifact?.id ||
            this.lastPublishedTargets?.length ||
            this.pendingActionChain?.length ||
            this.missionTaskStack?.length ||
            this.currentWorkflowState ||
            this.currentRun?.toolsUsed?.browserAction
        );
        if (!hasMemory) return false;

        if (['continue', 'proceed', 'resume', 'go on', 'next', 'carry on'].includes(value) && this._shouldForceBrowserContinuation()) {
            return true;
        }

        const directFollowUp = /\b(this|that|same|current|latest|previous|above|it)\b/.test(value);
        const mutateIntent = /\b(update|edit|modify|revise|change|delete|remove|send|share|publish|post|promote|continue|resume|reuse|adapt|repurpose|use)\b/.test(value);
        const crossDomainIntent = /\bfacebook|instagram|meta|linkedin|x|twitter|google|whatsapp|email|quote|quotation|video|image|creative|caption|content|code|bug|feature\b/.test(value);
        return (directFollowUp && mutateIntent) || (mutateIntent && crossDomainIntent);
    }

    _augmentFollowUpRequest(text = '') {
        const value = String(text || '').trim();
        if (!value) return value;
        const parts = [];
        const artifact = this.currentMissionArtifact;
        const latestTarget = Array.isArray(this.lastPublishedTargets) ? this.lastPublishedTargets[0] : null;
        const queued = Array.isArray(this.pendingActionChain) ? this.pendingActionChain[0] : null;

        parts.push('[FOLLOW-UP MISSION CONTEXT]');
        if (artifact) {
            parts.push('Current artifact kind: ' + (artifact.kind || 'file'));
            if (artifact.path) parts.push('Current artifact path: ' + artifact.path);
            if (artifact.url) parts.push('Current artifact url: ' + artifact.url);
            if (artifact.files?.pdf) parts.push('Current artifact pdf: ' + artifact.files.pdf);
        }
        if (latestTarget) {
            const latestTargetUrl = latestTarget?.id && /^https?:/i.test(String(latestTarget.id)) ? latestTarget.id : (latestTarget?.details?.url || latestTarget?.details?.postUrl || null);
            parts.push('Latest published target channel: ' + (latestTarget.channel || 'unknown'));
            parts.push('Latest published target id: ' + (latestTarget.id || 'unknown'));
            parts.push('Latest published target action: ' + (latestTarget.action || 'unknown'));
            if (latestTargetUrl) parts.push('Latest published target url: ' + latestTargetUrl);
        }
        if (queued) {
            parts.push('Queued next action: ' + queued.type + ' on ' + (queued.channel || 'general'));
        }
        parts.push('Interpret references like this, that, it, same, current, and latest against this mission context first.');
        parts.push('If the Boss asks to delete or remove a published item, resolve against the latest published target first.');
        parts.push('If the Boss asks to send or share a quote, reuse the latest quote bundle files first.');
        parts.push('If the Boss asks to publish, promote, or adapt content, reuse the latest artifact first.');
        parts.push('Boss request: ' + value);
        return parts.join('\n');
    }

    _buildMissionMemoryContext() {
        const sections = [];
        sections.push(`[MISSION DOMAIN]\nCurrent active domain: ${this.activeMissionDomain || 'general'}\nWhen the Boss jumps to another task, preserve the latest artifact/target memory and adapt instead of pretending the previous task never happened.\n`);
        if (this.currentMissionArtifact?.path || this.currentMissionArtifact?.url) {
            sections.push(`[MISSION ARTIFACT]\nCurrent artifact kind: ${this.currentMissionArtifact.kind || 'file'}\nCurrent artifact path: ${this.currentMissionArtifact.path || 'n/a'}\nCurrent artifact url: ${this.currentMissionArtifact.url || 'n/a'}\nSource tool: ${this.currentMissionArtifact.sourceTool || 'unknown'}\nIf the Boss says "use this", "promote this", "update this", "modify this", or "delete this", assume they mean this artifact first.\n`);
        }
        if (this.lastPublishedTargets?.length) {
            const latest = this.lastPublishedTargets[0];
            sections.push(`[PUBLISHED TARGET]\nLatest published channel: ${latest.channel || 'unknown'}\nLatest published id: ${latest.id || 'unknown'}\nTarget type: ${latest.type || 'published_output'}\nIf the Boss asks to update/delete/remove the published content, resolve it against this target first.\n`);
        }
        if (this.missionTaskStack?.length) {
            const stackSummary = this.missionTaskStack.slice(0, 6)
                .map((item, index) => `${index + 1}. ${item.domain} :: ${item.label}`)
                .join('\n');
            sections.push(`[RECENT TASK MEMORY]\n${stackSummary}\n`);
        }
        if (this.pendingActionChain?.length) {
            const queueSummary = this.pendingActionChain
                .map((item, index) => `${index + 1}. ${item.type} [${item.status}]`)
                .join('\n');
            sections.push(`[QUEUED NEXT ACTIONS]\n${queueSummary}\nAfter completing the current step, ask for approval before executing the next queued risky step.\n`);
        }
        return sections.length ? `${sections.join('\n')}` : '';
    }

    _classifyMissionDomain(toolCall = {}) {
        const name = String(toolCall?.name || '').toLowerCase();
        const action = String(toolCall?.args?.action || '').toLowerCase();
        if (name.includes('meta') || name.includes('googleads') || name.includes('linkedin') || name.includes('xads') || action.includes('campaign') || action.includes('publish')) return 'marketing';
        if (name === 'generateimage' || name === 'generatevideo' || name === 'removebg') return 'media';
        if (name === 'readfile' || name === 'writefile' || name === 'replacefilecontent' || name === 'multireplacefilecontent' || name === 'runcommand' || name === 'codemap' || name === 'codesearch' || name === 'codefindfn') return 'development';
        if (name === 'createagencyquoteartifacts' || name === 'buildagencyquoteplan') return 'commercial';
        if (name === 'sendemail' || name === 'reademail' || name === 'sendwhatsapp' || name === 'sendwhatsappmedia') return 'communications';
        if (name === 'browseraction' || name === 'searchweb') return 'research';
        return 'general';
    }

    _pushMissionTask(domain, label) {
        this.missionTaskStack = Array.isArray(this.missionTaskStack) ? this.missionTaskStack : [];
        this.missionTaskStack.unshift({
            domain: domain || 'general',
            label: String(label || 'Task').slice(0, 180),
            at: new Date().toISOString()
        });
        this.missionTaskStack = this.missionTaskStack.slice(0, 12);
        this.activeMissionDomain = domain || this.activeMissionDomain || 'general';
    }

    _resolveLatestTargetId(channel = '') {
        const normalized = String(channel || '').trim().toLowerCase();
        const targets = Array.isArray(this.lastPublishedTargets) ? this.lastPublishedTargets : [];
        const match = normalized ? targets.find((item) => String(item.channel || '').toLowerCase() === normalized) : targets[0];
        return match?.id || null;
    }

    _registerMissionTarget(details = {}) {
        const target = {
            id: details.id || `target_${Date.now()}`,
            channel: details.channel || details.domain || 'general',
            type: details.type || 'external_target',
            action: details.action || '',
            status: details.status || 'completed',
            details: details.details || null,
            artifactId: details.artifactId || this.currentMissionArtifact?.id || null,
            createdAt: new Date().toISOString()
        };
        this.lastPublishedTargets = Array.isArray(this.lastPublishedTargets) ? this.lastPublishedTargets : [];
        this.lastPublishedTargets.unshift(target);
        this.lastPublishedTargets = this.lastPublishedTargets.slice(0, 8);
        return target;
    }
    _createOutputUrlFromPath(filePath) {
        const absolutePath = String(filePath || '').trim();
        if (!absolutePath || !this.taskDir) return null;
        const normalizedTaskDir = path.resolve(this.taskDir);
        const normalizedPath = path.resolve(absolutePath);
        if (!normalizedPath.startsWith(normalizedTaskDir)) return null;
        const folderName = path.basename(this.taskDir);
        const relativePath = path.relative(this.taskDir, normalizedPath).split(path.sep).map(encodeURIComponent).join('/');
        return `/outputs/${folderName}/${relativePath}`;
    }

    _registerMissionArtifact(details = {}) {
        const artifact = {
            id: `artifact_${Date.now()}`,
            kind: details.kind || 'file',
            path: details.path || null,
            url: details.url || this._createOutputUrlFromPath(details.path),
            files: details.files || null,
            prompt: details.prompt || '',
            sourceTool: details.sourceTool || '',
            aspectRatio: details.aspectRatio || null,
            createdAt: new Date().toISOString()
        };
        this.currentMissionArtifact = artifact;
        this.missionArtifactHistory = Array.isArray(this.missionArtifactHistory) ? this.missionArtifactHistory : [];
        this.missionArtifactHistory.unshift(artifact);
        this.missionArtifactHistory = this.missionArtifactHistory.slice(0, 12);
        if (artifact.path) this.lastUploadedFile = artifact.path;
        return artifact;
    }

    _captureToolOutcome(toolCall, result) {
        const name = String(toolCall?.name || '');
        const action = String(toolCall?.args?.action || '');
        const text = this._formatToolResult(result);
        const domain = this._classifyMissionDomain(toolCall);
        this._pushMissionTask(domain, `${name}${action ? `:${action}` : ''}`);

        if (name === 'generateImage' && /^Success:/i.test(text)) {
            const savedPath = toolCall?.args?.savePath || text.match(/saved to\s+(.+)$/i)?.[1]?.trim();
            if (savedPath) {
                this._registerMissionArtifact({
                    kind: 'image',
                    path: savedPath,
                    prompt: toolCall?.args?.prompt || '',
                    sourceTool: 'generateImage',
                    aspectRatio: toolCall?.args?.aspectRatio || null
                });
            }
            if (this.pendingActionChain?.length && this.pendingActionChain[0]?.status === 'pending_confirmation') {
                const nextAction = this.pendingActionChain[0];
                nextAction.status = 'awaiting_boss';
                this.isWaitingForInput = true;
                this.onUpdate({
                    type: 'input_requested',
                    message: `Step 1 completed. The generated image is ready. Reply YES to continue to the next queued step (${nextAction.type}), or describe changes to revise the image first.`
                });
            }
            return;
        }

        if (name === 'generateVideo' && /^SUCCESS:/i.test(text)) {
            const outputPath = toolCall?.args?.outputPath || text.match(/at\s+(.+)$/i)?.[1]?.trim();
            if (outputPath) {
                this._registerMissionArtifact({ kind: 'video', path: outputPath, prompt: toolCall?.args?.prompt || '', sourceTool: 'generateVideo' });
            }
            return;
        }

        if ((name === 'writeFile' || name === 'replaceFileContent' || name === 'multiReplaceFileContent') && toolCall?.args?.absolutePath) {
            this._registerMissionArtifact({ kind: 'code', path: toolCall.args.absolutePath, prompt: toolCall?.args?.replacementContent || '', sourceTool: name });
            return;
        }

        if (name === 'createAgencyQuoteArtifacts' && result?.files) {
            this._registerMissionArtifact({
                kind: 'quote_bundle',
                url: result.files.pdf || result.files.markdown || null,
                path: null,
                prompt: toolCall?.args?.scope || '',
                sourceTool: name,
                files: result.files
            });
            return;
        }

        if ((name === 'sendEmail' || name === 'sendWhatsApp' || name === 'sendWhatsAppMedia') && !String(text).toLowerCase().startsWith('error')) {
            this._registerMissionTarget({ channel: name === 'sendEmail' ? 'email' : 'whatsapp', domain, type: 'message_delivery', action: name, details: { preview: text.slice(0, 400), attachments: toolCall?.args?.attachments || [] } });
            return;
        }

        if ((name === 'linkedinAds' && action === 'deletePost' && result && !result.error) || (name === 'linkedinDeletePost' && result && !result.error)) {
            this._registerMissionTarget({
                id: result?.id || toolCall?.args?.postId || this._resolveLatestTargetId('linkedin'),
                channel: 'linkedin',
                domain,
                type: 'deleted_output',
                action: action || name,
                status: 'deleted',
                details: result || null
            });
            return;
        }

        if ((name === 'xAds' && action === 'deletePost' && result && !result.error) || (name === 'xDeletePost' && result && !result.error)) {
            this._registerMissionTarget({
                id: toolCall?.args?.postUrl || result?.url || this._resolveLatestTargetId('x'),
                channel: 'x',
                domain,
                type: 'deleted_output',
                action: action || name,
                status: 'deleted',
                details: result || null
            });
            return;
        }

        if ((name === 'metaAds' && action.startsWith('publishOrganic') && result && !result.error) || (name === 'linkedinAds' && action === 'publishPost' && result && !result.error) || (name === 'xAds' && result && !result.error)) {
            const publishedCopy = String(toolCall?.args?.text || toolCall?.args?.message || '').trim();
            if (publishedCopy) {
                this._registerMissionArtifact({
                    kind: 'content',
                    path: null,
                    url: null,
                    prompt: publishedCopy,
                    sourceTool: `${name}${action ? `:${action}` : ''}`,
                    files: toolCall?.args?.imagePath ? { imagePath: toolCall.args.imagePath } : null
                });
            }
            this._registerMissionTarget({
                id: result?.id || result?.post_id || result?.url || result?.surfaces?.facebook?.post_id || result?.surfaces?.facebook?.id || null,
                channel: name === 'metaAds' ? 'meta' : name === 'linkedinAds' ? 'linkedin' : 'x',
                domain,
                type: 'published_output',
                action: action || name,
                details: result?.surfaces || result || null
            });
            if (this.pendingActionChain?.length && this.pendingActionChain[0]?.type === 'promote_generated_asset') {
                this.pendingActionChain.shift();
            }
        }
    }

    async _handleQueuedActionContinuation(userInput) {
        const nextAction = this.pendingActionChain?.[0];
        if (!nextAction || nextAction.status !== 'awaiting_boss') return false;
        const decision = GovernanceService.isApprovalResponse(userInput);
        if (decision === null) return false;
        if (!decision) {
            this.pendingActionChain.shift();
            this.onUpdate({ type: 'thought', message: 'Queued next action cancelled by the Boss. The current artifact remains active for further edits.' });
            return true;
        }
        nextAction.status = 'approved';
        const artifactReference = this.currentMissionArtifact?.path || this.currentMissionArtifact?.url || this.lastUploadedFile || 'the active artifact';
        let continuationPrompt = `Boss approved the next queued action. Continue now: ${nextAction.prompt} Use the current mission artifact at ${artifactReference} and pause for approval before publishing or any risky external action.`;

        if (nextAction.type === 'send_quote_bundle') {
            const quoteFiles = this.currentMissionArtifact?.files || {};
            const preferredAttachment = quoteFiles.pdf || quoteFiles.markdown || this.currentMissionArtifact?.path || null;
            const attachmentLine = preferredAttachment ? `When ready, call sendEmail with attachments containing this local file path: ${preferredAttachment}.` : 'If no local file exists, include a direct artifact link in the body.';
            continuationPrompt = `Boss approved the quote handoff. Ask only for the exact missing recipient email or subject if needed, then prepare the email using the latest quote bundle. Preferred attachment/link: ${preferredAttachment || this.currentMissionArtifact?.url || 'the latest quote file'}. ${attachmentLine} Pause for approval before the actual sendEmail tool call.`;
        }

        if (nextAction.type === 'share_quote_bundle') {
            const quoteFiles = this.currentMissionArtifact?.files || {};
            const preferredMedia = quoteFiles.pdf || this.currentMissionArtifact?.url || quoteFiles.markdown || 'the latest quote file';
            continuationPrompt = `Boss approved the WhatsApp quote handoff. Ask only for the exact missing phone number or message if needed, then prepare the WhatsApp sharing step using the latest quote bundle. Preferred media/link: ${preferredMedia}. Prefer sendWhatsAppMedia when a shareable file/link is available, otherwise use sendWhatsApp with the quote summary and link. Pause for approval before the actual outbound tool call.`;
        }

        if (nextAction.type === 'publish_written_content') {
            continuationPrompt = `Boss approved the content publishing step. Reuse the latest approved copy/artifact context, adapt it for ${nextAction.channel}, and pause for approval before the public publish action.`;
        }

        if (nextAction.type === 'publish_generated_video') {
            continuationPrompt = `Boss approved the video publishing step. Use the latest generated video artifact, adapt it for ${nextAction.channel}, and pause for approval before any public publish action.`;
        }

        this.context.push({
            role: 'user',
            content: continuationPrompt
        });
        this.pendingActionChain.shift();
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

    _hasTaskDeliverableEvidence() {
        const contract = this.currentTaskContract || {};
        const deliverable = String(contract.expectedDeliverable || '').toLowerCase();
        const artifact = this.currentMissionArtifact || null;
        const latestTarget = Array.isArray(this.lastPublishedTargets) ? this.lastPublishedTargets[0] : null;

        if (!deliverable || deliverable === 'direct answer or requested output') {
            if (this._shouldForceBrowserContinuation()) {
                return Boolean(this.currentRun?.toolsUsed?.browserAction);
            }
            return true;
        }

        if (deliverable.includes('quote')) {
            return Boolean(artifact?.kind === 'quote_bundle' || artifact?.files?.pdf || artifact?.files?.markdown);
        }
        if (deliverable.includes('invoice')) {
            return Boolean(artifact?.files?.pdf || /invoice/i.test(String(artifact?.kind || '')) || /invoice/i.test(String(artifact?.path || '')));
        }
        if (deliverable.includes('image asset')) {
            return Boolean(artifact?.kind === 'image' || /\.(png|jpg|jpeg|webp)$/i.test(String(artifact?.path || '')));
        }
        if (deliverable.includes('video asset')) {
            return Boolean(artifact?.kind === 'video' || /\.mp4$/i.test(String(artifact?.path || '')));
        }
        if (deliverable.includes('email')) {
            return Boolean(latestTarget?.channel === 'email');
        }
        if (deliverable.includes('whatsapp message')) {
            return Boolean(latestTarget?.channel === 'whatsapp');
        }
        if (deliverable.includes('analysis report')) {
            return Boolean(artifact?.path || artifact?.url || this.currentRun?.toolCalls > 0);
        }
        if (deliverable.includes('verified fix')) {
            return Boolean(artifact?.kind === 'code' || this.currentRun?.toolsUsed?.replaceFileContent || this.currentRun?.toolsUsed?.multiReplaceFileContent || this.currentRun?.toolsUsed?.writeFile);
        }
        if (deliverable.includes('code change')) {
            return Boolean(artifact?.kind === 'code');
        }

        return true;
    }

    _canDeclareTaskComplete(responseText = '') {
        const text = String(responseText || '').toLowerCase();
        const mentionsCompletion =
            /\b(task complete|mission complete|completed|done|finished|all set|that's all)\b/i.test(text) &&
            !/\bnot (done|finished|complete)\b/i.test(text);

        if (!mentionsCompletion) return false;
        if (!this._hasTaskDeliverableEvidence()) return false;
        return true;
    }

    _normalizeClarificationQuestion(question = '') {
        return String(question || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    _extractClarificationQuestion(responseText = '') {
        const text = String(responseText || '').trim();
        if (!text) return null;
        const candidates = text
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean)
            .filter((line) =>
                /\?$/.test(line) ||
                /please provide|i need your|should i proceed|waiting for your|your confirmation|tell me/i.test(line)
            );

        if (!candidates.length) return null;

        const best = candidates.find((line) => /\?$/.test(line)) || candidates[0];
        if (best.length > 220) return null;
        return best;
    }

    _shouldAskClarification(question = '') {
        const normalized = this._normalizeClarificationQuestion(question);
        if (!normalized) return { allow: false, reason: 'empty' };

        if (this.pendingClarification?.normalized === normalized) {
            return { allow: false, reason: 'duplicate' };
        }

        return { allow: true, reason: 'new' };
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
            '- Build an internal task contract with: requested outcome, expected deliverable, direct success test, and forbidden side quests.',
            '- Do not call any tool unless it directly advances the requested outcome.',
            '- Do not invent tool capabilities. Use only the exact supported tool names and action names.',
            '- Prefer deterministic tool use over generic chat explanations when a supported tool exists.',
            '- You have access to a massive library of 1,300+ Standard Operating Procedures (skills) via the `readAgenticSkill` tool. Always use it to load an SOP (like "@seo-audit" or "@react-patterns") into your context before performing complex architecture, debugging, or execution tasks.'
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

    _buildTaskContract(userRequest = '') {
        const value = String(userRequest || '').trim();
        const lower = value.toLowerCase();
        const deliverableHints = [];
        if (/\bquote|quotation|estimate|proposal\b/.test(lower)) deliverableHints.push('quote');
        if (/\binvoice\b/.test(lower)) deliverableHints.push('invoice');
        if (/\bemail\b/.test(lower)) deliverableHints.push('email');
        if (/\bwhatsapp\b/.test(lower)) deliverableHints.push('whatsapp message');
        if (/\bimage|banner|poster|creative|thumbnail|logo\b/.test(lower)) deliverableHints.push('image asset');
        if (/\bvideo|reel\b/.test(lower)) deliverableHints.push('video asset');
        if (/\baudit|analyze|analysis|review|check\b/.test(lower)) deliverableHints.push('analysis report');
        if (/\bfix|debug\b/.test(lower)) deliverableHints.push('verified fix');
        if (/\bcode|file|function\b/.test(lower)) deliverableHints.push('code change');

        const sideQuestGuard = [];
        if (!/\bsearch|research|browse|find online|google\b/.test(lower)) {
            sideQuestGuard.push('Do not browse or research unless the Boss asked for it.');
        }
        if (!/\bskill|sop|playbook|expert|architecture|complex|advanced\b/.test(lower)) {
            sideQuestGuard.push('Do not load specialist skills unless the task is clearly complex and relevant.');
        }
        if (!/\bpublish|post|send|share|email|whatsapp|meta|linkedin|x|twitter|google ads?\b/.test(lower)) {
            sideQuestGuard.push('Do not perform outbound, public, or paid actions unless explicitly requested.');
        }

        const routingProfile = this._deriveTaskRoutingProfile(lower);

        return {
            objective: value || 'Complete the current user request.',
            expectedDeliverable: deliverableHints.length ? deliverableHints.join(', ') : 'direct answer or requested output',
            successTest: 'The final output must match the user request and be supported by real tool output when tools are used.',
            sideQuestGuard,
            routingProfile
        };
    }

    _deriveTaskRoutingProfile(lower = '') {
        const isBrowserTask = /\b(open|browser|website|site|page|url|portal|login|navigate|click|fill|form|submit|quiz|question)\b/.test(lower);
        const isCodeTask = /\b(code|bug|fix|debug|file|function|repo|project|server|frontend|backend|test)\b/.test(lower);
        const isCommercialTask = /\b(quote|quotation|proposal|invoice|pricing|estimate)\b/.test(lower);
        const isMarketingTask = /\b(marketing|audit|seo|campaign|ad|social|competitor|landing page|organic|facebook|instagram|meta)\b/.test(lower);
        const isImageTask = /\b(image|banner|poster|creative|thumbnail|logo|flyer|brochure)\b/.test(lower);
        const isVideoTask = /\b(video|reel|shorts|animation|promo video|promo reel)\b/.test(lower);
        const isOutboundTask = /\b(email|whatsapp|send|share|reply|message)\b/.test(lower);
        const wantsResearch = /\b(search|research|browse|find online|look up|google)\b/.test(lower);

        if (isBrowserTask) {
            return {
                domain: 'browser',
                preferredTools: ['browserAction', 'searchWeb', 'askUserForInput'],
                allowedTools: ['browserAction', 'searchWeb', 'askUserForInput', 'saveMemory', 'searchMemory'],
                blockedTools: ['generateImage', 'generateVideo', 'metaAds', 'googleAds', 'linkedinAds', 'xAds', 'buildAgencyQuotePlan', 'createAgencyQuoteArtifacts']
            };
        }

        if (isCodeTask) {
            return {
                domain: 'code',
                preferredTools: ['readFile', 'listDir', 'codeMap', 'codeSearch', 'codeFindFn', 'replaceFileContent', 'multiReplaceFileContent', 'runCommand'],
                allowedTools: ['readFile', 'writeFile', 'listDir', 'replaceFileContent', 'multiReplaceFileContent', 'runSed', 'runCommand', 'checkBackgroundTask', 'codeMap', 'codeSearch', 'codeFindFn', 'askUserForInput', 'saveMemory', 'searchMemory'],
                blockedTools: ['metaAds', 'googleAds', 'linkedinAds', 'xAds', 'sendEmail', 'sendWhatsApp', 'browserAction']
            };
        }

        if (isCommercialTask) {
            return {
                domain: 'commercial',
                preferredTools: ['buildAgencyQuotePlan', 'createAgencyQuoteArtifacts', 'askUserForInput'],
                allowedTools: ['buildAgencyQuotePlan', 'createAgencyQuoteArtifacts', 'askUserForInput', 'saveMemory', 'searchMemory'],
                blockedTools: ['browserAction', 'metaAds', 'googleAds', 'linkedinAds', 'xAds', 'generateImage', 'generateVideo']
            };
        }

        if (isOutboundTask) {
            return {
                domain: 'outbound',
                preferredTools: ['sendEmail', 'sendWhatsApp', 'askUserForInput'],
                allowedTools: ['sendEmail', 'sendWhatsApp', 'sendWhatsAppMedia', 'readEmail', 'askUserForInput', 'saveMemory', 'searchMemory'],
                blockedTools: ['browserAction', 'metaAds', 'googleAds', 'linkedinAds', 'xAds']
            };
        }

        const isMetaOrganicTask = /\b(organic|facebook|instagram|meta)\b/.test(lower) && /\b(post|publish|promote|ad|creative|image|banner|photo)\b/.test(lower);

        if (isMarketingTask && isMetaOrganicTask) {
            return {
                domain: 'marketing',
                preferredTools: ['generateImage', 'metaAds', 'askUserForInput'],
                allowedTools: ['generateImage', 'metaAds', 'analyzeMarketingPage', 'scanCompetitors', 'generateSocialCalendar', 'askUserForInput', 'saveMemory', 'searchMemory'],
                blockedTools: ['browserAction', 'buildAgencyQuotePlan', 'createAgencyQuoteArtifacts']
            };
        }

        if (isImageTask && !isVideoTask) {
            return {
                domain: 'image',
                preferredTools: ['generateImage', 'removeBg', 'askUserForInput'],
                allowedTools: ['generateImage', 'removeBg', 'askUserForInput', 'saveMemory', 'searchMemory'],
                blockedTools: ['browserAction', 'generateVideo', 'metaAds', 'googleAds', 'linkedinAds', 'xAds', 'buildAgencyQuotePlan', 'createAgencyQuoteArtifacts']
            };
        }

        if (isVideoTask && !isImageTask) {
            return {
                domain: 'video',
                preferredTools: ['generateVideo', 'askUserForInput'],
                allowedTools: ['generateVideo', 'askUserForInput', 'saveMemory', 'searchMemory'],
                blockedTools: ['browserAction', 'generateImage', 'removeBg', 'metaAds', 'googleAds', 'linkedinAds', 'xAds', 'buildAgencyQuotePlan', 'createAgencyQuoteArtifacts']
            };
        }

        if (isImageTask && isVideoTask) {
            return {
                domain: 'media',
                preferredTools: ['generateImage', 'generateVideo', 'removeBg', 'askUserForInput'],
                allowedTools: ['generateImage', 'generateVideo', 'removeBg', 'askUserForInput', 'saveMemory', 'searchMemory'],
                blockedTools: ['browserAction', 'metaAds', 'googleAds', 'linkedinAds', 'xAds', 'buildAgencyQuotePlan', 'createAgencyQuoteArtifacts']
            };
        }

        if (isMarketingTask) {
            const allowedTools = ['analyzeMarketingPage', 'scanCompetitors', 'generateSocialCalendar', 'askUserForInput', 'saveMemory', 'searchMemory'];
            if (isMetaOrganicTask) {
                allowedTools.push('generateImage', 'metaAds');
            }
            if (wantsResearch) allowedTools.push('searchWeb');
            return {
                domain: 'marketing',
                preferredTools: isMetaOrganicTask
                    ? ['generateImage', 'metaAds', 'askUserForInput']
                    : ['analyzeMarketingPage', 'scanCompetitors', 'generateSocialCalendar', wantsResearch ? 'searchWeb' : 'askUserForInput'].filter(Boolean),
                allowedTools,
                blockedTools: ['browserAction', 'buildAgencyQuotePlan', 'createAgencyQuoteArtifacts']
            };
        }

        return {
            domain: 'general',
            preferredTools: ['askUserForInput', 'searchWeb'],
            allowedTools: null,
            blockedTools: []
        };
    }

    _buildTaskContractPrompt() {
        const contract = this.currentTaskContract;
        if (!contract) return '';
        const guardLines = contract.sideQuestGuard?.length
            ? contract.sideQuestGuard.map((item) => `- ${item}`).join('\n')
            : '- Avoid irrelevant side quests.';
        const routing = contract.routingProfile || {};
        const preferred = Array.isArray(routing.preferredTools) && routing.preferredTools.length ? routing.preferredTools.join(', ') : 'Use the most relevant tools only.';
        const blocked = Array.isArray(routing.blockedTools) && routing.blockedTools.length ? routing.blockedTools.join(', ') : 'None';
        return `### TASK CONTRACT\nRequested outcome: ${contract.objective}\nExpected deliverable: ${contract.expectedDeliverable}\nSuccess test: ${contract.successTest}\nPrimary domain: ${routing.domain || 'general'}\nPreferred tools: ${preferred}\nAvoid these tools unless the Boss clearly changes the task: ${blocked}\nSide-quest guardrails:\n${guardLines}\nIf your next step does not directly advance this contract, do not do it.\n\n`;
    }

    _isToolRelevantToTask(toolCall = {}) {
        const name = String(toolCall?.name || '').toLowerCase();
        const argsText = JSON.stringify(toolCall?.args || {}).toLowerCase();
        const request = String(this.currentTaskContract?.objective || this._getLatestUserText() || '').toLowerCase();
        if (!request) return true;
        const routingProfile = this.currentTaskContract?.routingProfile || {};
        const allowedTools = Array.isArray(routingProfile.allowedTools) ? routingProfile.allowedTools.map((item) => String(item || '').toLowerCase()) : null;
        const blockedTools = Array.isArray(routingProfile.blockedTools) ? routingProfile.blockedTools.map((item) => String(item || '').toLowerCase()) : [];

        if (blockedTools.includes(name)) return false;
        if (allowedTools && allowedTools.length && !allowedTools.includes(name)) return false;

        const mentions = (...patterns) => patterns.some((pattern) => pattern.test(request));
        const isCodeTask = mentions(/\bcode|bug|fix|debug|file|function|repo|project\b/);
        const isMarketingTask = mentions(/\bmarketing|audit|seo|landing page|campaign|ad|social|competitor\b/);
        const isCommercialTask = mentions(/\bquote|quotation|proposal|invoice|pricing|estimate\b/);
        const isMediaTask = mentions(/\bimage|banner|poster|creative|thumbnail|logo|video|reel\b/);
        const isOutboundTask = mentions(/\bemail|whatsapp|send|share\b/);
        const asksForResearch = mentions(/\bsearch|research|browse|find|look up|google\b/);

        if (['sendemail', 'sendwhatsapp', 'sendwhatsappmedia'].includes(name) && !isOutboundTask) return false;
        if (['buildagencyquoteplan', 'createagencyquoteartifacts'].includes(name) && !isCommercialTask) return false;
        if (['generateimage', 'generatevideo', 'removebg'].includes(name) && !isMediaTask) return false;
        if (['readfile', 'writefile', 'replacefilecontent', 'multireplacefilecontent', 'runcommand', 'codemap', 'codesearch', 'codefindfn'].includes(name) && !isCodeTask) return false;
        if (['analyzemarketingpage', 'scancompetitors', 'generatesocialcalendar', 'metaads', 'googleads', 'linkedinads', 'xads'].includes(name) && !(isMarketingTask || isOutboundTask || isCommercialTask)) return false;
        if (name === 'searchweb' && !asksForResearch && !(isMarketingTask && /competitor|benchmark|trend/.test(request))) return false;
        if ((name === 'readagenticskill' || name === 'findagenticskill') && !mentions(/\bcomplex|architecture|deep|advanced|audit|specialist|expert\b/)) return false;
        if (name === 'browseraction' && !mentions(/\bbrowser|website|site|page|url|portal|login|open|navigate|click|form\b/) && !/https?:/.test(argsText)) return false;

        return true;
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

    _isBrowserMissionRequest(text = '') {
        const value = String(text || '').toLowerCase();
        return /\b(open|browser|url|http|click|navigate|fill|form|submit|quiz|question|option|login|portal|website)\b/.test(value);
    }

    _shouldForceBrowserContinuation(originalRequest = '') {
        const latestUser = this._getLatestUserText ? this._getLatestUserText() : '';
        const contractObjective = String(this.currentTaskContract?.objective || '').toLowerCase();
        const request = String(originalRequest || contractObjective || latestUser || '').toLowerCase();
        return this._isBrowserMissionRequest(request) || Boolean(this.currentRun?.toolsUsed?.browserAction);
    }

    _getLlmOptionsForCurrentMission(overrides = {}) {
        const routingProfile = this.currentTaskContract?.routingProfile || null;
        const options = {
            mode: this.currentMissionMode,
            sessionId: this.currentSessionId,
            onStatus: (message) => {
                if (message) this.onUpdate({ type: 'thought', message: `LLM Status: ${message}` });
            },
            ...overrides
        };

        if (this._shouldForceBrowserContinuation()) {
            options.allowedTools = [
                'browserAction',
                'askUserForInput',
                'searchWeb',
                'saveMemory',
                'searchMemory'
            ];
        } else if (Array.isArray(routingProfile?.allowedTools) && routingProfile.allowedTools.length) {
            options.allowedTools = routingProfile.allowedTools;
        }

        return options;
    }

    async _bootstrapBrowserMissionIfNeeded(originalRequest = '') {
        if (!this._shouldForceBrowserContinuation(originalRequest)) return false;
        if (this.currentRun?.toolsUsed?.browserAction) return false;

        const targetUrl = this._extractFirstUrl(originalRequest || this._getLatestUserText());
        if (!targetUrl) return false;

        this.onUpdate({ type: 'thought', message: `Browser kickoff: opening ${targetUrl} directly so Nexus can start from the real page state instead of a narrated plan.` });

        const toolCall = { name: 'browserAction', args: { action: 'open', url: targetUrl } };
        let result = await this.dispatchTool(toolCall);
        this._captureToolOutcome(toolCall, result);
        this.onUpdate({ type: 'action', name: toolCall.name, args: toolCall.args });
        this.onUpdate({ type: 'result', message: this._formatToolResult(result) });
        this.context.push({ role: 'assistant', content: '', toolCall });

        const pageContent = await this.tools.browserAction({ action: 'getMarkdown' });
        result = `${this._formatToolResult(result)}\n\n[PROACTIVE PAGE SCAN]:\n${pageContent}`;
        this.context.push({ role: 'tool', name: toolCall.name, content: result });
        this.onUpdate({ type: 'thought', message: `🔍 Auto-Sync: Page opened. Performing background 'getMarkdown' for immediate context...` });
        this.onUpdate({ type: 'result', message: this._formatToolResult(result).slice(0, 5000) });
        return true;
    }

    _isBrowserHesitationResponse(text = '') {
        const value = String(text || '').toLowerCase();
        return (
            value.includes('do not have the inherent knowledge') ||
            value.includes('i do not have the inherent knowledge') ||
            value.includes('need your instructions on how to determine') ||
            value.includes('cannot determine the correct answers') ||
            value.includes('please provide the correct answers') ||
            value.includes('i will need your instructions')
        );
    }

    _isWeakBrowserTextTurn(response = {}, originalRequest = '') {
        if (!this._shouldForceBrowserContinuation(originalRequest)) return false;
        if (response?.toolCall) return false;
        const text = String(response?.text || '').trim().toLowerCase();
        if (!text) return true;
        return (
            text.includes('let me start by') ||
            text.includes('here\'s my plan') ||
            text.includes('i will open') ||
            text.includes('i can help you') ||
            text.includes('to get started') ||
            text.includes('ready for your instructions')
        );
    }

    async _describeExecutionEngine(toolCall) {
        const { name, args = {} } = toolCall || {};
        if (!name) return null;

        if (name === 'generate_image' || name === 'improveImage') {
            return 'Execution engine: Google Imagen 4.0 Ultra (`imagen-4.0-ultra-generate-001`).';
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
        let consecutiveEmptyResponses = 0; // [CIRCUIT BREAKER] Prevent infinite empty-response loops
        const maxConsecutiveEmpty = 3;
        await this._bootstrapBrowserMissionIfNeeded(originalRequest);
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
            stateContext += this._buildMissionMemoryContext();
            stateContext += this._buildTaskContractPrompt();

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
            const turnId = this.context.length + 1;
            console.log(`[Orchestrator] Starting Mission Turn #${turnId}... (Context: ${this.context.length} msgs)`);
            this.onUpdate({ type: 'thought', message: `🔍 **Nexus is thinking...** (Turn #${turnId})` });
            
            // [RESILIENCE] LLM Call with Autonomous Retry for 400 Errors
            let response;
            try {
                const llmContext = this._trimContextForLlm(this.context);
                response = await this.llmService.generateResponse(llmContext, this._getLlmOptionsForCurrentMission());
            } catch (err) {
                const errMsg = err.message || '';
                const isEmptyOutputErr = errMsg.includes('model output must contain') || errMsg.includes('output text or tool calls') || errMsg.includes('both be empty');
                if (err.message?.includes('400') || err.message?.includes('thought_signature') || isEmptyOutputErr) {
                    if (isEmptyOutputErr) {
                        consecutiveEmptyResponses++;
                        if (consecutiveEmptyResponses >= maxConsecutiveEmpty) {
                            this.onUpdate({ type: 'thought', message: `🛑 **Circuit Breaker:** The AI model returned empty responses ${maxConsecutiveEmpty} times. This is likely a content filtering or safety block. Please rephrase your request.` });
                            this._finishRun('completed');
                            return;
                        }
                        response = { text: '⚠️ Empty model response detected. Retrying...', toolCall: null, provider: 'Gemini', model: 'unknown' };
                    } else {
                        console.error(`[RESILIENCE] Signature Mismatch detected. Purging pinned key and retrying turn...`);
                        this.llmService.pinnedKeys?.delete(this.currentSessionId);
                        const llmContext = this._trimContextForLlm(this.context);
                        response = await this.llmService.generateResponse(llmContext, this._getLlmOptionsForCurrentMission());
                    }
                } else {
                    throw err;
                }
            }
            console.log(`[Orchestrator] Turn #${turnId} handled by ${response.provider}/${response.model}. (Text: ${!!response.text}, Tool: ${response.toolCall?.name || 'none'})`);

            // [RESILIENCE] Protect against completely empty API responses
            if (!response.text && !response.toolCall) {
                consecutiveEmptyResponses++;
                console.warn(`[RESILIENCE] LLM returned completely empty response (${consecutiveEmptyResponses}/${maxConsecutiveEmpty}). Injecting fallback...`);
                if (consecutiveEmptyResponses >= maxConsecutiveEmpty) {
                    this.onUpdate({ type: 'thought', message: `🛑 **Circuit Breaker:** The AI model returned empty responses ${maxConsecutiveEmpty} times in a row. This is likely a content filtering issue. Please rephrase your request.` });
                    this._finishRun('completed');
                    return;
                }
                response.text = "I received an empty response. Could you please rephrase your request?";
            } else {
                consecutiveEmptyResponses = 0; // Reset on successful response
            }

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
                } else if (response.text.trim()) {
                    this.onUpdate({ type: 'thought', message: response.text });
                }
                this.context.push({ 
                    role: 'assistant', 
                    content: response.text,
                    parts: response.parts // [ADVANCED] Preserve raw metadata (thoughts/signatures)
                });

                if (organicDraft && this._shouldAutoRequestOrganicApproval(originalRequest || this.context.find(m => m.role === 'user')?.content || '', response.text)) {
                    if (await this._queueOrganicDraftApprovalFromDraft()) {
                        this._finishRun('paused');
                        return;
                    }
                }
            }

            if (!response.toolCall) {
                const salvagedToolCall = this._extractToolCallFromNarration(response.text);
                if (salvagedToolCall) {
                    this.onUpdate({ type: 'thought', message: 'Recovered a real tool call from narrated tool text. Executing it now.' });
                    response.toolCall = salvagedToolCall;
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
                    content: response.text || '',
                    toolCall: response.toolCall,
                    parts: response.parts // [ADVANCED] Preserve raw metadata (thoughts/signatures)
                });

                this.onUpdate({ type: 'thought', message: `🛠️ **[${response.provider || 'AI'}/${response.model || 'Brain'}] Calling tool:** ${response.toolCall.name}` });

                if (response.toolCall.name === 'askUserForInput') {
                    const question = String(response.toolCall.args.question || '').trim();
                    const clarificationDecision = this._shouldAskClarification(question);
                    if (!clarificationDecision.allow) {
                        this.context.push({
                            role: 'user',
                            content: 'SYSTEM CORRECTION: Do not repeat the same clarification request. Either continue with the information already available or ask one different, more specific missing-field question only if absolutely necessary.'
                        });
                        continue;
                    }
                    this.pendingClarification = {
                        question,
                        normalized: this._normalizeClarificationQuestion(question),
                        requestedAt: new Date().toISOString()
                    };
                    this.onUpdate({ type: 'input_requested', message: `💬 **[${response.provider || 'AI'}/${response.model || 'Brain'}] Internal Question:** ${question}` });
                    this.isWaitingForInput = true;
                    this._finishRun('paused');
                    return; // Pause execution
                }

                // Execute the tool with specialist fail-safe logic
                let result;
                try {
                    result = await this.dispatchTool(response.toolCall);
                    this.onUpdate({ type: 'thought', message: `✅ **Tool result received from ${response.toolCall.name}.**` });
                } catch (err) {
                    this.onUpdate({ type: 'thought', message: `⚠️ Specialist Insight: An expert-level hurdle has been encountered in [${response.toolCall.name}].` });
                    
                    // Generate a "Specialist Recovery Report" instead of a simple error
                    const troubleshootingSkills = SkillReaderTool.searchSkills(err.message + " " + response.toolCall.name);
                    const skillContext = troubleshootingSkills.length > 0 ? `Relevant expert SOPs found for repair: ${troubleshootingSkills.join(', ')}` : "No direct local repair SOP found.";

                    const recoveryPrompt = `The system encountered a technical error: "${err.message}" while running the tool "${response.toolCall.name}". 
${skillContext}

As a professional expert, analyze this failure and propose 3 distinct ways the Boss can help me finish this task (e.g., provide a different API key, use a different tool, or manual workaround). Act like a pro employee—refer to alternatives and suggest how we can create it despite this hurdle.`;
                    
                    const recoveryReport = await this.llmService.generateResponse([{ role: 'user', content: recoveryPrompt }], { mode: 'chat' });
                    result = `### SPECIALIST RECOVERY REPORT\n${recoveryReport.text || err.message}`;
                    this.onUpdate({ type: 'thought', message: result });
                }

                if (this.isStopped) break;
                
                // [RESILIENCE] Auto-Sync Intelligence: If we just opened a page, automatically scan it to eliminate "flying blind"
                if (response.toolCall.name === 'browserAction' && ['open', 'click', 'clickText', 'keyPress'].includes(response.toolCall.args.action) && !String(result).toLowerCase().includes('error')) {
                    this.onUpdate({ type: 'thought', message: `🔍 Auto-Sync: Page opened. Performing background 'getMarkdown' for immediate context...` });
                    const pageContent = await this.tools.browserAction({ action: 'getMarkdown' });
                    result = `${result}\n\n[PROACTIVE PAGE SCAN]:\n${pageContent}`;
                }

                this._captureToolOutcome(response.toolCall, result);
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
                // The LLM returned text only (no tool call). Check if it's asking a question or if it's just "thinking out loud".
                const textLower = (response.text || "").toLowerCase();

                // [RESILIENCE] Provider reported an unexpected/invalid tool call. Auto-correct and retry.
                if (textLower.includes('unexpected_tool_call')) {
                    const latestUser = this._getLatestUserText();
                    const likelyBanner = this._isCreativeAssetRequest(latestUser);
                    const targetUrl = this._extractFirstUrl(latestUser);
                    const correction = this._shouldForceBrowserContinuation(latestUser)
                        ? `ERROR: You attempted an invalid tool call during a browser mission. You MUST use browser tools only. Start with browserAction using action "open"${targetUrl ? ` and url "${targetUrl}"` : ''}. After opening, use getMarkdown or extractActiveElements to inspect the page, then continue step by step until the browser task is complete. Do not call generateImage or unrelated tools. Respond ONLY with a valid tool call from the provided tool schema.`
                        : likelyBanner
                            ? "ERROR: You attempted an invalid tool call. For this request, you MUST call generateImage with a concrete banner prompt (Meta Ads style). Do NOT call metaAds yet. Respond ONLY with a valid tool call."
                            : "ERROR: You attempted an invalid tool call. Respond ONLY with a valid tool call from the provided tool schema.";
                    this.onUpdate({ type: 'thought', message: `\u26a0\ufe0f **Detection:** Invalid tool call from LLM (UNEXPECTED_TOOL_CALL). Retrying with correction...` });
                    this.context.push({ role: 'user', content: correction });
                    continue;
                }
                const isExplicitCompletion = this._canDeclareTaskComplete(response.text);
                const isAskingQuestion = textLower.includes('please provide') || 
                                         textLower.includes('i need your') ||
                                         textLower.includes('what you would like me to do') ||
                                         textLower.includes('ready for your instructions') ||
                                         textLower.includes('should i proceed') ||
                                         textLower.includes('waiting for your') ||
                                         textLower.includes('your confirmation');
                
                // [RESILIENCE] Detect "Narrative Action" where model describes tools instead of calling them
                // This must run BEFORE the explicit completion check to catch "hallucinated success".
                const containsMarkdownMedia = /!\[[^\]]*\]\(([^)]+)\)/i.test(response.text || '');
                const containsPlaceholderMedia = /\[(image|video|preview|file|audio|attachment):/i.test(textLower);
                const containsToolCodeBlock = /<\s*tool_code\s*>/i.test(response.text || '') || /"tool_code"\s*:/i.test(response.text || '') || /```(?:python|json|javascript)?[\s\S]*?\b(browserAction|generateImage|generateVideo|metaAds|sendEmail|sendWhatsApp)\s*\(/i.test(response.text || '');
                const containsPythonToolNarration = /\bnexus_os\.(generateimage|generatevideo|metaads|browseraction)\b/i.test(response.text || '') || /\b(browserAction|generateImage|generateVideo|metaAds|sendEmail|sendWhatsApp)\s*\(/i.test(response.text || '');
                const isNarratingToolSuccess =
                    /\b(i will use|i'll use|calling tool|now using|generating now|here is the image|post is ready|successfully (published|sent|created|generated))\b/i.test(textLower) ||
                    containsPlaceholderMedia ||
                    containsMarkdownMedia ||
                    containsToolCodeBlock ||
                    containsPythonToolNarration;
                
                // Don't treat internal breach notices as "narrated action".
                const isInternalBreachNotice = textLower.trimStart().startsWith('mission breach:');
                if (!isInternalBreachNotice && (this.currentMissionMode === 'execute' || this.currentMissionMode === 'chat') && isNarratingToolSuccess && !response.toolCall) {
                    const latestUser = this._getLatestUserText();
                    const correction = this._isMetaOrganicImageRequest(latestUser)
                        ? "ERROR: For this Meta organic image request, do not narrate. First call generateImage to create the single-image creative. After the creative exists, prepare the organic Meta publish payload and wait for approval before any publish action. Respond ONLY with a valid tool call."
                        : "ERROR: You narrated an action or provided a text placeholder (e.g. [Image:] or ![Preview](...)) but failed to provide a structured tool call. DO NOT narrate tool execution in text. You MUST use the available tools (e.g., generateImage, metaAds, browserAction) via the function schema to perform actions. Repeat the task now using a REAL tool call.";
                    this.onUpdate({ type: 'thought', message: `⚠️ **Detection:** Narrated action without tool call. Injecting correction...` });
                    this.context.push({ role: 'user', content: correction });
                    continue;
                }

                const shouldForceBrowserContinuation = this._shouldForceBrowserContinuation(originalRequest);

                if (shouldForceBrowserContinuation && this._isBrowserHesitationResponse(response.text || '')) {
                    this.onUpdate({ type: 'thought', message: 'Browser mission hesitation detected. Nexus is forcing page-state continuation instead of stopping early.' });
                    this.context.push({ role: 'user', content: 'SYSTEM CORRECTION: This is a browser mission. Do not stop because you lack inherent knowledge. Re-scan the page, read the visible UI, infer the next step, and continue autonomously. Only ask the Boss if OTP, captcha, payment approval, or truly private missing information is required.' });
                    continue;
                }

                if (isExplicitCompletion) {
                    this.onUpdate({ type: 'complete', message: 'Task Complete. No further actions requested.' });
                    isTaskCompleted = true;
                    this._finishRun('completed');
                    break;
                }

                if ((response.text || '').trim() && /\b(task complete|mission complete|completed|done|finished|all set|that's all)\b/i.test(textLower) && !isExplicitCompletion) {
                    this.onUpdate({
                        type: 'thought',
                        message: 'Completion claim ignored because Nexus does not yet have enough evidence that the requested deliverable was actually produced.'
                    });
                    this.context.push({
                        role: 'user',
                        content: 'SYSTEM CORRECTION: Do not declare completion yet. The requested deliverable is not sufficiently evidenced. Continue only with steps that directly produce or verify the deliverable.'
                    });
                    continue;
                }

                // [RESILIENCE] In CHAT mode, a text-only reply IS the response — pause for user input.
                if (this.currentMissionMode === 'chat') {
                    console.log(`[Chat Mode] Conversational reply sent. Pausing for user input.`);
                    this.onUpdate({ type: 'pause' });
                    this.isWaitingForInput = true;
                    this._finishRun('paused');
                    return;
                }

                if (isAskingQuestion) {
                    if (shouldForceBrowserContinuation && !/otp|captcha|mfa|verification code|payment|approve|approval|password/i.test(textLower)) {
                        this.context.push({ role: 'user', content: 'SYSTEM CORRECTION: Do not pause this browser mission for a generic clarification. Continue with the page state, scan the page again if needed, and ask only if human-only input is truly mandatory.' });
                        continue;
                    }
                    const extractedQuestion = this._extractClarificationQuestion(response.text);
                    const clarificationDecision = this._shouldAskClarification(extractedQuestion || response.text);
                    if (extractedQuestion && clarificationDecision.allow) {
                        this.pendingClarification = {
                            question: extractedQuestion,
                            normalized: this._normalizeClarificationQuestion(extractedQuestion),
                            requestedAt: new Date().toISOString()
                        };
                        this.onUpdate({ type: 'input_requested', message: extractedQuestion });
                        this.isWaitingForInput = true;
                        this._finishRun('paused');
                        return;
                    }
                    if (!clarificationDecision.allow) {
                        this.context.push({
                            role: 'user',
                            content: 'SYSTEM CORRECTION: Do not repeat the same vague clarification. Continue with the available context or ask one new, specific missing-field question only if the task is truly blocked.'
                        });
                        continue;
                    }
                }

                if (this._isWeakBrowserTextTurn(response, originalRequest)) {
                    this.context.push({
                        role: 'user',
                        content: 'SYSTEM CORRECTION: This browser mission is already in execute mode. Do not restate a plan or wait conversationally. Inspect the current browser page state and issue the next real browserAction tool call now.'
                    });
                    continue;
                }

                if (textLower.length > 0) {
                    this.onUpdate({ type: 'thought', message: response.text });
                }
                console.log(`[RESILIENCE] Text-only turn detected. Continuing loop for tool execution...`);
                continue;
            }
        }

        if (!isTaskCompleted) {
            this.onUpdate({ type: 'complete', message: 'Process finished.' });
            this._finishRun(this.isWaitingForInput ? 'paused' : 'completed');
        }

        // MISSION STABILITY: Only close browser if explicitly requested or if it's a "leaf" mission.
        const requestToCheck = originalRequest || (this.context.find(m => m.role === 'user')?.content || "");
        const usedBrowser = Boolean(this.currentRun?.toolsUsed?.browserAction);
        const hasExplicitClose = /auto[- ]?close(d)?/i.test(requestToCheck) || /stop browser|close browser/i.test(requestToCheck);
        
        // Don't close if we are waiting for input, OR if we used the browser and haven't finished the goal.
        const shouldClose = !this.isWaitingForInput && hasExplicitClose;
        
        if (shouldClose && usedBrowser) {
            this.onUpdate({ type: 'step', message: 'Auto-closing browser as requested or per mission completion protocol...' });
            await this.browserInstance.close();
        } else if (usedBrowser && !this.isWaitingForInput) {
            this.onUpdate({ type: 'thought', message: "🌐 **Persistence Layer:** Browser session remains active for subsequent turn continuity." });
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
            // SECURITY: The model must never be able to "self-approve" a dangerous action.
            // Only _handleApprovalResponse() can set boss_approved=true with skipGovernance enabled.
            if ('boss_approved' in normalizedArgs) delete normalizedArgs.boss_approved;
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

        if (toolCall.name === 'linkedinDeletePost') {
            return { name: 'linkedinAds', args: { ...(toolCall.args || {}), action: 'deletePost' } };
        }

        if (toolCall.name === 'twitterAds' || toolCall.name === 'x' || toolCall.name === 'tweet') {
            return { name: 'xAds', args: { ...(toolCall.args || {}) } };
        }

        if (toolCall.name === 'xDeletePost') {
            return { name: 'xAds', args: { ...(toolCall.args || {}), action: 'deletePost' } };
        }

        return toolCall;
    }

    _extractToolCallFromNarration(text = '') {
        const value = String(text || '');
        if (!value) return null;

        const openMatch = value.match(/browserAction\s*\(\s*action\s*=\s*['"]open['"]\s*,\s*url\s*=\s*['"]([^'"]+)['"]\s*\)/i);
        if (openMatch) {
            return { name: 'browserAction', args: { action: 'open', url: openMatch[1] } };
        }

        const clickMatch = value.match(/browserAction\s*\(\s*action\s*=\s*['"]click['"]\s*,\s*selector\s*=\s*['"]([^'"]+)['"]\s*\)/i);
        if (clickMatch) {
            return { name: 'browserAction', args: { action: 'click', selector: clickMatch[1] } };
        }

        const clickTextMatch = value.match(/browserAction\s*\(\s*action\s*=\s*['"]clickText['"]\s*,\s*text\s*=\s*['"]([^'"]+)['"]\s*\)/i);
        if (clickTextMatch) {
            return { name: 'browserAction', args: { action: 'clickText', text: clickTextMatch[1] } };
        }

        const waitForSelectorMatch = value.match(/browserAction\s*\(\s*action\s*=\s*['"]waitForSelector['"]\s*,\s*selector\s*=\s*['"]([^'"]+)['"]\s*\)/i);
        if (waitForSelectorMatch) {
            return { name: 'browserAction', args: { action: 'waitForSelector', selector: waitForSelectorMatch[1] } };
        }

        const extractTextMatch = value.match(/browserAction\s*\(\s*action\s*=\s*['"](extractActiveElements|getMarkdown|waitForNetworkIdle)['"](?:\s*,\s*timeout\s*=\s*(\d+))?\s*\)/i);
        if (extractTextMatch) {
            const args = { action: extractTextMatch[1] };
            if (extractTextMatch[2]) args.timeout = Number(extractTextMatch[2]);
            return { name: 'browserAction', args };
        }

        const clearAndTypeMatch = value.match(/browserAction\s*\(\s*action\s*=\s*['"]clearAndType['"]\s*,\s*selector\s*=\s*['"]([^'"]+)['"]\s*,\s*text\s*=\s*['"]([^'"]*)['"]\s*\)/i);
        if (clearAndTypeMatch) {
            return { name: 'browserAction', args: { action: 'clearAndType', selector: clearAndTypeMatch[1], text: clearAndTypeMatch[2] } };
        }

        return null;
    }

    _isPlaceholderValue(value) {
        const v = String(value ?? '').trim().toLowerCase();
        if (!v) return false;
        return (
            v.startsWith('your_') ||
            v.includes('path_to_your_') ||
            v.includes('example.com') ||
            v === 'todo' ||
            v === 'tbd'
        );
    }

    _isCreativeAssetRequest(text = '') {
        const t = String(text || '').toLowerCase();
        return /\b(banner|poster|flyer|thumbnail|creative|ad\s*creative)\b/.test(t) || /\b(generate|create)\b.*\b(image|banner|creative)\b/.test(t);
    }

    _isMetaOrganicImageRequest(text = '') {
        const t = String(text || '').toLowerCase();
        return /\b(meta|facebook|instagram|organic)\b/.test(t) && /\b(image|banner|poster|creative|photo|ad)\b/.test(t);
    }

    _getLatestUserText() {
        for (let i = this.context.length - 1; i >= 0; i--) {
            if (this.context[i]?.role === 'user') return String(this.context[i]?.content || '');
        }
        return '';
    }

    _extractFirstUrl(text = '') {
        const value = String(text || '');
        const match = value.match(/https?:\/\/[^\s<>"')]+/i);
        return match ? match[0] : null;
    }

    _hasImageArtifact() {
        const p = String(this.currentMissionArtifact?.path || this.lastUploadedFile || '').trim();
        return Boolean(p) && /\.(png|jpg|jpeg|webp)$/i.test(p);
    }

    _trimContextForLlm(context = []) {
        // Prevent "request too large" / max context loops by keeping a small, high-signal window.
        const MAX_MESSAGES = 24;
        const MAX_TOOL_CHARS = 4000;
        const MAX_TEXT_CHARS = 8000;

        const sliced = Array.isArray(context) ? context.slice(-MAX_MESSAGES) : [];
        return sliced.map((m) => {
            const role = m?.role;
            const out = { ...m };

            if (role === 'tool') {
                const s = typeof out.content === 'string' ? out.content : JSON.stringify(out.content || {});
                out.content = s.length > MAX_TOOL_CHARS ? `${s.slice(0, MAX_TOOL_CHARS)}\n...[TRUNCATED]` : s;
                return out;
            }

            if (role === 'user' || role === 'assistant' || role === 'system') {
                const s = String(out.content || '');
                out.content = s.length > MAX_TEXT_CHARS ? `${s.slice(0, MAX_TEXT_CHARS)}\n...[TRUNCATED]` : s;
                return out;
            }

            return out;
        });
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
        if (name === 'linkedinPublishPost' || (name === 'linkedinAds' && args?.action === 'publishPost')) {
            return Boolean(result && typeof result === 'object' && (result.success === true || result.id));
        }
        if (name === 'linkedinDeletePost' || (name === 'linkedinAds' && args?.action === 'deletePost')) {
            return Boolean(result && typeof result === 'object' && (result.success === true || result.deleted === true));
        }
        if (name === 'xDeletePost' || (name === 'xAds' && args?.action === 'deletePost')) {
            return Boolean(result && typeof result === 'object' && (result.success === true || result.deleted === true));
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
            const status = typeof this.tools?.metaAds?.getSetupStatus === 'function'
                ? await this.tools.metaAds.getSetupStatus()
                : await MetaAdsTool.getSetupStatus();
            const action = String(args.action || '');

            // GUARD: If the Boss asked for a creative/banner, we must generate the asset first.
            // Do not attempt Meta publishing/creative creation until an image artifact exists.
            const latestUser = this._getLatestUserText();
            const creativeFirst = this._isCreativeAssetRequest(latestUser);
            if (creativeFirst && !this._hasImageArtifact()) {
                return {
                    ok: false,
                    error: `Meta action ${action} blocked: banner/image must be generated first. Use generateImage, then ask for approval to publish/promote.`,
                    missingKeys: ['IMAGE_ASSET'],
                    provider: 'meta'
                };
            }

            // GUARD: Block placeholder arguments so we don't enter approval loops with fake ids/paths.
            const placeholderKeys = ['pageId', 'adAccountId', 'imageHash', 'imagePath', 'videoPath', 'link'];
            const placeholders = placeholderKeys.filter((k) => this._isPlaceholderValue(args?.[k]));
            if (placeholders.length) {
                return {
                    ok: false,
                    error: `Meta action ${action} blocked: placeholder values detected for ${placeholders.join(', ')}. Provide real values or generate/upload the asset first.`,
                    missingKeys: placeholders.map((k) => `REAL_${k.toUpperCase()}`),
                    provider: 'meta'
                };
            }

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

        if (name === 'linkedinAds' || name === 'linkedinPublishPost' || name === 'linkedinDeletePost') {
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
            case 'deleteObject':
                return await MetaAdsTool.deleteObject(args.objectId || this._resolveLatestTargetId('meta'));
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
            case 'deletePost':
                return await LinkedInAdsTool.deletePost(args.postId || this._resolveLatestTargetId('linkedin'));
            default:
                return `Unknown linkedinAds action: ${action}`;
        }
    }

    async _runXAdsAction(args = {}) {
        const action = String(args.action || 'publishPost');
        switch (action) {
            case 'publishPost':
                XAdsTool.browserAction = (browserArgs) => this.browserInstance.executeAction(browserArgs);
                return await XAdsTool.publishOrganicPost(args.text, args.imagePath || this.lastUploadedFile || null);
            case 'deletePost':
                XAdsTool.browserAction = (browserArgs) => this.browserInstance.executeAction(browserArgs);
                return await XAdsTool.deletePost(args.postUrl || this._resolveLatestTargetId('x'));
            default:
                return `Unknown xAds action: ${action}`;
        }
    }

    async _dispatchTool(toolCall, options = {}) {
        const normalizedToolCall = this._normalizeToolCall(toolCall);
        const { name } = normalizedToolCall;
        let args = normalizedToolCall.args;
        
        if (this.currentRun) {
            this.currentRun.toolCalls += 1;
            this.currentRun.lastTool = name;
            this.currentRun.toolsUsed[name] = (this.currentRun.toolsUsed[name] || 0) + 1;
            const toolUsageKey = `${name}::${String(args?.action || '').trim() || 'default'}`;
            this.currentRun.toolUsage = this.currentRun.toolUsage || {};
            this.currentRun.toolUsage[toolUsageKey] = {
                tool: name,
                action: String(args?.action || '').trim() || '',
                calls: Number(this.currentRun.toolUsage[toolUsageKey]?.calls || 0) + 1
            };
        }
        await UsageTracker.recordToolUsage({
            tool: name,
            action: String(args?.action || '').trim() || '',
            provider: ['metaAds', 'googleAds', 'linkedinAds', 'xAds'].includes(name) ? name : 'Nexus',
            clientId: this.currentClientId || null,
            sessionId: this.currentSessionId || null,
            runId: this.currentRun?.id || null,
            requestPreview: this.currentRun?.requestPreview || ''
        });

        try {
            if (!this._isToolRelevantToTask(normalizedToolCall)) {
                const request = this.currentTaskContract?.objective || this._getLatestUserText() || 'the active task';
                return `MISSION BREACH: Tool '${name}' is not relevant to the current task. Stay focused on: ${request}`;
            }

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

            // SECURITY: If this call is being executed after explicit user approval, set boss_approved here.
            // The model never gets to set boss_approved itself (we strip it in _normalizeToolCall).
            if (options.skipGovernance && governance.requiresApproval) {
                args = { ...(args || {}), boss_approved: true };
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
            if (['metaAds', 'googleAds', 'linkedinAds', 'xAds'].includes(name)) {
                if (name === 'metaAds') {
                    const dangerous = ['createCampaign', 'createAdSet', 'createAdCreative', 'createAd', 'publishOrganicPost', 'publishOrganicPhoto', 'publishOrganicVideo', 'publishOrganicReel'];
                    if (dangerous.includes(args.action) && args.boss_approved !== true) return "⚠️ MISSION BREACH: Dangerous action attempted without approval.";
                }
                return await this.tools[name](args);
            }

            // C. Special Handler: Generative Media
            if (name === 'generateImage') {
                const resolvedSavePath = args.savePath || path.join(this.taskDir || __dirname, `generated_image_${Date.now()}.png`);
                const result = await ImageGenTool.generateImage(args.prompt, resolvedSavePath, { aspectRatio: args.aspectRatio, refine: args.refine });
                if (!String(result).toLowerCase().startsWith('error')) {
                    await this._recordMediaUsage('Gemini', 'imagen-4.0-generate-001', 'free', 0);
                    this._registerMissionArtifact({
                        kind: 'image',
                        path: resolvedSavePath,
                        prompt: args.prompt,
                        sourceTool: 'generateImage',
                        aspectRatio: args.aspectRatio || null
                    });
                }
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
        const llmContext = this._trimContextForLlm(this.context);
        const response = await this.llmService.generateResponse(llmContext, { mode: 'chat', enableTools: false });
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
            this._captureToolOutcome(approvedCall, result);
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

        const scopeLabel = this.currentClientId ? 'current client' : 'Boss workspace';

        this.pendingRequirement = {
            requestedAt: new Date().toISOString(),
            toolCall,
            keys,
            scope: this.currentClientId ? 'client' : 'boss'
        };
        const keyMessage = keys.length === 1
            ? `Reply with the value for ${keys[0]} and Nexus will save it to the ${scopeLabel}, then continue.`
            : `Reply using KEY=value or KEY: value lines for these settings: ${keys.join(', ')}. Nexus will save them to the ${scopeLabel}, then continue.`;
        this.onUpdate({
            type: 'input_requested',
            message: `Mission is blocked by missing configuration for ${toolCall.name}: ${keys.join(', ')}.\n\nSave target: ${scopeLabel}.\n${keyMessage}`
        });
        return true;
    }

    async _saveRequirementValues(values) {
        if (!db) throw new Error('Firebase is not initialized.');
        const collection = this.currentClientId ? 'client_configs' : 'configs';
        const docId = this.currentClientId || 'default';
        await db.collection(collection).doc(docId).set(values, { merge: true });
        require('./core/config').refresh();
        return {
            collection,
            docId,
            scopeLabel: this.currentClientId ? 'current client' : 'Boss workspace'
        };
    }

    async _handleRequirementResponse(userInput) {
        const pending = this.pendingRequirement;
        const trimmed = String(userInput || '').trim();
        if (!trimmed) {
            this.onUpdate({ type: 'input_requested', message: `Still waiting for ${pending.keys.join(', ')}. I will save them to the ${pending.scope === 'client' ? 'current client' : 'Boss workspace'}.` });
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
                const separatorIndex = line.includes('=') ? line.indexOf('=') : line.indexOf(':');
                if (separatorIndex > 0) {
                    const key = line.slice(0, separatorIndex).trim();
                    const value = line.slice(separatorIndex + 1).trim();
                    if (key && value) values[key] = value;
                }
            }
        }

        const missingStill = pending.keys.filter((key) => !values[key]);
        if (missingStill.length) {
            this.onUpdate({ type: 'input_requested', message: `I still need: ${missingStill.join(', ')}. Please reply with ${missingStill.length === 1 ? 'the value' : 'KEY=value or KEY: value lines'}.` });
            return;
        }

        const saveMeta = await this._saveRequirementValues(values);
        this._recordAudit('requirement_saved', { keys: pending.keys, tool: pending.toolCall.name });
        this.context.push({ role: 'user', content: `Boss supplied required configuration for ${pending.keys.join(', ')}. Continue the current mission.` });
        this.pendingRequirement = null;
        this.onUpdate({ type: 'thought', message: `Saved ${Object.keys(values).join(', ')} to the ${saveMeta.scopeLabel} and resuming the mission.` });
        await this.resume('Required configuration has been saved. Continue the current mission without restarting it.');
    }

    _beginRun(request) {
        this.stepCount = 0; // Reset step counter for each new mission
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
            toolUsage: {},
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

        // [TRANSPARENCY] Provide a professional closing signal if the mission completed successfully
        // Only signal "Achieved" if at least one tool call was performed, otherwise it's just a conversational turn
        if (status === 'completed' && !this.isWaitingForInput && (this.currentRun.toolCalls > 0 || this.stepCount > 1)) {
            this.onUpdate({ 
                type: 'thought', 
                message: `🎯 **Mission Goal Achieved:** Nexus has completed the required actions for this turn. Standing by for your next directive, Boss.` 
            });
        }
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
            currentMissionArtifact: this.currentMissionArtifact || null,
            missionArtifactHistory: (this.missionArtifactHistory || []).slice(0, 10),
            pendingActionChain: this.pendingActionChain || [],
            lastPublishedTargets: (this.lastPublishedTargets || []).slice(0, 5),
            activeMissionDomain: this.activeMissionDomain || 'general',
            missionTaskStack: (this.missionTaskStack || []).slice(0, 10),
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
            currentMissionArtifact: this.currentMissionArtifact || null,
            missionArtifactHistory: this.missionArtifactHistory || [],
            pendingActionChain: this.pendingActionChain || [],
            lastPublishedTargets: this.lastPublishedTargets || [],
            activeMissionDomain: this.activeMissionDomain || 'general',
            missionTaskStack: this.missionTaskStack || [],
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
        if (state.currentClientId !== undefined) this.currentClientId = state.currentClientId;
        if (state.currentMarketingWorkflow !== undefined) this.currentMarketingWorkflow = state.currentMarketingWorkflow;
        if (state.missionMode !== undefined) this.currentMissionMode = state.missionMode;
        if (state.manualMissionMode !== undefined) this.manualMissionMode = state.manualMissionMode;
        if (state.isWaitingForInput !== undefined) this.isWaitingForInput = state.isWaitingForInput;
        if (state.currentRun) this.currentRun = state.currentRun;
        if (state.recentRuns) this.recentRuns = state.recentRuns;
        if (state.currentOrganicMetaDraft) this.currentOrganicMetaDraft = state.currentOrganicMetaDraft;
        if (state.currentWorkflowState) this.currentWorkflowState = state.currentWorkflowState;
        if (state.currentMissionArtifact) this.currentMissionArtifact = state.currentMissionArtifact;
        if (state.missionArtifactHistory) this.missionArtifactHistory = state.missionArtifactHistory;
        if (state.pendingActionChain) this.pendingActionChain = state.pendingActionChain;
        if (state.lastPublishedTargets) this.lastPublishedTargets = state.lastPublishedTargets;
        if (state.activeMissionDomain) this.activeMissionDomain = state.activeMissionDomain;
        if (state.missionTaskStack) this.missionTaskStack = state.missionTaskStack;
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











