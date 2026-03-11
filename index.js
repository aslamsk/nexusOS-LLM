const fs = require('fs');
const path = require('path');
const FileSystemTool = require('./tools/fileSystem');
const TerminalTool = require('./tools/terminal');
const BrowserTool = require('./tools/browser');
const ImageGenTool = require('./tools/imageGen');
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
            runCommand: TerminalTool.runCommand,
            browserAction: BrowserTool.executeAction.bind(BrowserTool),
            generateImage: ImageGenTool.generateImage.bind(ImageGenTool)
        };
        this.llmService = new LLMService();
        this.maxSteps = 15;
        this.taskDir = taskDir;
        // Callback to emit events to the frontend
        this.onUpdate = onUpdate || ((event) => console.log(`[${event.type.toUpperCase()}]`, event.message || event.args || ''));
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

                // Execute the tool
                const result = await this.dispatchTool(response.toolCall);
                const resultString = String(result);
                const truncatedResult = resultString.length > 500 ? resultString.substring(0, 500) + '...' : resultString;

                this.onUpdate({ type: 'result', message: truncatedResult });

                // Add result back to context
                this.context.push({ role: 'tool', name: response.toolCall.name, content: result });
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
