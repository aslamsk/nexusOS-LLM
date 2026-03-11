const puppeteer = require('puppeteer');

/**
 * Nexus OS Tool: Browser Sub-agent
 * Provides web automation capabilities.
 */
class BrowserTool {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async init() {
        if (!this.browser) {
            const isProd = process.env.NODE_ENV === 'production' || process.env.K_SERVICE; // Detect Cloud Run
            this.browser = await puppeteer.launch({
                headless: isProd ? 'new' : false,
                args: isProd ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
            });
            this.page = await this.browser.newPage();
            // Set a realistic viewport
            await this.page.setViewport({ width: 1280, height: 800 });
        } else if (this.page && this.page.isClosed()) {
            this.page = await this.browser.newPage();
            await this.page.setViewport({ width: 1280, height: 800 });
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    /**
     * Dispatcher for browser actions requested by the LLM
     */
    async executeAction(args) {
        await this.init();

        const action = args.action;
        try {
            switch (action) {
                case 'open':
                    if (!args.url) return 'Error: action=open requires url';
                    try {
                        await this.page.goto(args.url, { waitUntil: 'networkidle2' });
                    } catch (navError) {
                        console.log("Navigation error, recreating page: " + navError.message);
                        this.page = await this.browser.newPage();
                        await this.page.setViewport({ width: 1280, height: 800 });
                        await this.page.goto(args.url, { waitUntil: 'networkidle2' });
                    }
                    return `Successfully opened ${args.url}. Page title: ${await this.page.title()}`;

                case 'click':
                    if (!args.selector) return 'Error: action=click requires selector';
                    await this.page.waitForSelector(args.selector, { timeout: 5000 });
                    await this.page.click(args.selector);
                    return `Successfully clicked selector: ${args.selector}`;

                case 'type':
                    if (!args.selector || !args.text) return 'Error: action=type requires selector and text';
                    await this.page.waitForSelector(args.selector, { timeout: 5000 });
                    await this.page.type(args.selector, args.text);
                    return `Successfully typed into selector: ${args.selector}`;

                case 'extract':
                    if (!args.selector) return 'Error: action=extract requires selector';
                    await this.page.waitForSelector(args.selector, { timeout: 5000 });
                    const text = await this.page.$eval(args.selector, el => el.innerText);
                    return `Extracted text from ${args.selector}:\n${text}`;

                case 'screenshot':
                    if (!args.savePath) return 'Error: action=screenshot requires savePath';
                    await this.page.screenshot({ path: args.savePath, fullPage: true });
                    return `Saved screenshot to ${args.savePath}`;

                default:
                    return `Error: Unknown browser action '${action}'`;
            }
        } catch (error) {
            return `Browser action error: ${error.message}`;
        }
    }
}

module.exports = new BrowserTool();
