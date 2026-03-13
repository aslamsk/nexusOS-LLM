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
        } else if (!this.page || this.page.isClosed()) {
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
                        const isBotBlocked = navError.message.includes('Protocol error') || 
                                             navError.message.includes('Connection closed') ||
                                             navError.message.includes('timeout');
                        
                        if (isBotBlocked && !args.url.includes('r.jina.ai')) {
                            console.log(`[BrowserTool] Bot block detected for ${args.url}. Retrying via Jina proxy...`);
                            const proxyUrl = `https://r.jina.ai/${args.url}`;
                            await this.page.goto(proxyUrl, { waitUntil: 'networkidle2' });
                            return `Successfully opened ${args.url} via Jina Proxy (Bypass active).`;
                        }

                        console.log("Navigation error, recreating page: " + navError.message);
                        this.page = await this.browser.newPage();
                        await this.page.setViewport({ width: 1280, height: 800 });
                        await this.page.goto(args.url, { waitUntil: 'networkidle2' });
                    }
                    return `Successfully opened ${args.url}. Page title: ${await this.page.title()}`;

                case 'scrape':
                    if (!args.url) return 'Error: action=scrape requires url';
                    const jinaUrl = `https://r.jina.ai/${args.url}`;
                    await this.page.goto(jinaUrl, { waitUntil: 'networkidle2' });
                    const markdown = await this.page.evaluate(() => document.body.innerText);
                    return markdown;

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

                case 'keyPress':
                    if (!args.key) return 'Error: action=keyPress requires key (e.g., "Enter")';
                    await this.page.keyboard.press(args.key);
                    return `Successfully pressed key: ${args.key}`;


                case 'waitForNetworkIdle':
                    const timeout = args.timeout || 15000;
                    try {
                        await this.page.waitForNetworkIdle({ idleTime: 1000, timeout: timeout });
                        return `Successfully waited for network to become idle (page has finished loading/updating).`;
                    } catch (err) {
                        return `Network did not become fully idle within ${timeout}ms, but proceeding anyway.`;
                    }

                case 'clickText':
                    if (!args.text) return 'Error: action=clickText requires text';
                    try {
                        // Use Puppeteer's built-in text selector which finds the deepest matching element
                        const selector = `::-p-text(${args.text})`;
                        await this.page.waitForSelector(selector, { timeout: 5000 });
                        // Click via evaluate to bypass strict visibility/overlay checks
                        await this.page.$eval(selector, el => el.click());
                        return `Successfully clicked element containing text: '${args.text}'`;
                    } catch (err) {
                        return `Error clicking element with text '${args.text}': ${err.message}`;
                    }

                case 'extract':
                    if (!args.selector) return 'Error: action=extract requires selector';
                    await this.page.waitForSelector(args.selector, { timeout: 5000 });
                    const text = await this.page.$eval(args.selector, el => el.innerText);
                    return `Extracted text from ${args.selector}:\n${text}`;

                case 'extractActiveElements':
                    // Wait briefly for generic JS frameworks to settle
                    await new Promise(r => setTimeout(r, 1000));

                    return await this.page.evaluate(() => {
                        const interactables = Array.from(document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [onclick], [tabindex]:not([tabindex="-1"])'));
                        const visibleElements = interactables.filter(el => {
                            const style = window.getComputedStyle(el);
                            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && el.offsetWidth > 0 && el.offsetHeight > 0;
                        });

                        const parsedElements = visibleElements.map((el, index) => {
                            // Assign a unique ID if it doesn't have one to make targeting easy
                            if (!el.id) el.id = `nx-autoid-${index}`;

                            let textContent = el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '';
                            textContent = textContent.replace(/\s+/g, ' ').trim();

                            return {
                                tag: el.tagName.toLowerCase(),
                                id: el.id,
                                text: textContent.substring(0, 100), // Max 100 chars
                                type: el.type || undefined
                            };
                        });

                        // Deduplicate and filter out empty text elements that aren't inputs
                        const uniqueMap = new Map();
                        parsedElements.forEach(item => {
                            if ((item.text || item.tag === 'input' || item.tag === 'textarea' || item.tag === 'select') && !uniqueMap.has(item.id)) {
                                uniqueMap.set(item.id, item);
                            }
                        });

                        const result = Array.from(uniqueMap.values());
                        if (result.length === 0) return "[] (No interactive elements found. The page might still be loading or requires scrolling.)";
                        return JSON.stringify(result, null, 2);
                    });

                case 'screenshot':
                    if (!args.savePath) return 'Error: action=screenshot requires savePath';
                    await this.page.screenshot({ path: args.savePath, fullPage: true });
                    return `Saved screenshot to ${args.savePath}`;

                default:
                    return `Error: Unknown browser action '${action}'`;
            }
        } catch (error) {
            if (this.page) {
                try { await this.page.close(); } catch (e) { }
                this.page = null;
            }
            return `Browser action error: ${error.message}`;
        }
    }
}

module.exports = new BrowserTool();
