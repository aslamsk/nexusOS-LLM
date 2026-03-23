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

    async init(isMobile = false, mobileDevice = 'ios') {
        // Check if browser is disconnected
        if (this.browser && !this.browser.isConnected()) {
            console.log("[Browser] Detected disconnected browser, cleaning up...");
            this.browser = null;
            this.page = null;
        }

        if (!this.browser) {
            const isProd = process.env.NODE_ENV === 'production' || process.env.K_SERVICE;
            console.log(`[Browser] Launching browser (prod=${isProd}, mobile=${isMobile})...`);
            const commonArgs = [
                '--ignore-certificate-errors',
                '--ignore-urlfetcher-cert-requests',
                '--disable-web-security'
            ];

            this.browser = await puppeteer.launch({
                headless: false, // Set to false to show the browser window to the user
                ignoreHTTPSErrors: true,
                args: isProd ? [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    ...commonArgs
                ] : commonArgs
            });
            this.page = await this.browser.newPage();
            await this._setupContext(isMobile, mobileDevice);
        } else if (!this.page || this.page.isClosed()) {
            this.page = await this.browser.newPage();
            await this._setupContext(isMobile, mobileDevice);
        }
    }

    async _setupContext(isMobile, mobileDevice = 'ios') {
        if (isMobile) {
            let deviceName;
            switch(mobileDevice) {
                case 'android': deviceName = 'Pixel 7'; break;
                case 'iphone-xs': deviceName = 'iPhone X'; break; // Puppeteer uses 'iPhone X' for XS/11 Pro dimensions
                default: deviceName = 'iPhone 13';
            }
            console.log(`[Browser] Emulating ${deviceName}...`);
            const device = puppeteer.KnownDevices[deviceName];
            if (device) {
                await this.page.emulate(device);
            } else {
                // Fallback to basic mobile viewport if device not found
                await this.page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
            }
        } else {
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
        await this.init(args.isMobile, args.mobileDevice);

        const action = args.action;
        try {
            switch (action) {
                case 'open':
                    if (!args.url) return 'Error: action=open requires url';
                    const navOptions = { waitUntil: 'domcontentloaded', timeout: 30000 };
                    try {
                        await this.page.goto(args.url, navOptions);
                    } catch (navError) {
                        console.log("Navigation error, recreating page: " + navError.message);
                        this.page = await this.browser.newPage();
                        await this.page.setViewport({ width: 1280, height: 800 });
                        await this.page.goto(args.url, navOptions);
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
                        const interactables = Array.from(document.querySelectorAll('a, button, input, select, textarea, label, [role="button"], [role="link"], [role="menuitem"], [onclick], [tabindex]:not([tabindex="-1"]), span, div'));
                        const visibleElements = interactables.filter(el => {
                            const style = window.getComputedStyle(el);
                            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && el.offsetWidth > 0 && el.offsetHeight > 0;
                        });

                        const parsedElements = visibleElements.map((el, index) => {
                            // Assign a unique ID if it doesn't have one to make targeting easy
                            if (!el.id) el.id = `nx-autoid-${index}`;

                            let textContent = el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '';
                            textContent = textContent.replace(/\s+/g, ' ').trim();

                            let isInteractive = false;
                            const tag = el.tagName.toLowerCase();
                            if (['a', 'button', 'input', 'select', 'textarea', 'label'].includes(tag) || el.hasAttribute('role') || el.hasAttribute('onclick') || el.hasAttribute('tabindex')) {
                                isInteractive = true;
                            } else if ((tag === 'span' || tag === 'div') && textContent.length > 0 && el.parentElement && el.parentElement.tagName.toLowerCase() === 'label') {
                                isInteractive = true; // spans inside labels are usually the text of a radio button
                            }

                            return {
                                tag: tag,
                                id: el.id,
                                text: textContent.substring(0, 100), // Max 100 chars
                                type: el.type || undefined,
                                _isInteractive: isInteractive
                            };
                        });

                        // Deduplicate and filter out empty text elements that aren't inputs
                        const uniqueMap = new Map();
                        parsedElements.forEach(item => {
                            if (item._isInteractive && (item.text || item.tag === 'input' || item.tag === 'textarea' || item.tag === 'select') && !uniqueMap.has(item.id)) {
                                delete item._isInteractive; // Remove internal flag
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

                case 'annotateAndScreenshot':
                    if (!args.savePath) return 'Error: action=annotateAndScreenshot requires savePath';
                    // Inject Antigravity-style labels
                    await this.page.evaluate(() => {
                        const style = document.createElement('style');
                        style.id = 'nx-agent-style';
                        style.innerHTML = `
                            .nx-agent-box { position: absolute; border: 2px solid rgba(231, 76, 60, 0.8); background: rgba(231, 76, 60, 0.1); pointer-events: none; z-index: 2147483647; }
                            .nx-agent-label { position: absolute; background: #e74c3c; color: white; padding: 2px 6px; font-size: 12px; font-weight: bold; font-family: sans-serif; pointer-events: none; transform: translateY(-100%); z-index: 2147483647; border-radius: 4px; }
                        `;
                        document.head.appendChild(style);

                        const interactables = Array.from(document.querySelectorAll('a, button, input, select, textarea, [role="button"], [onclick]'));
                        interactables.forEach((el, index) => {
                            const rect = el.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0) {
                                const box = document.createElement('div');
                                box.className = 'nx-agent-box nx-agent-cleanup';
                                box.style.left = window.scrollX + rect.left + 'px';
                                box.style.top = window.scrollY + rect.top + 'px';
                                box.style.width = rect.width + 'px';
                                box.style.height = rect.height + 'px';
                                
                                const label = document.createElement('div');
                                label.className = 'nx-agent-label nx-agent-cleanup';
                                label.style.left = window.scrollX + rect.left + 'px';
                                label.style.top = window.scrollY + rect.top + 'px';
                                label.innerText = el.id ? el.id : ('IDX-' + index);
                                if (!el.id) el.id = 'IDX-' + index;

                                document.body.appendChild(box);
                                document.body.appendChild(label);
                            }
                        });
                    });

                    // Wait a tick for render
                    await new Promise(r => setTimeout(r, 500));
                    await this.page.screenshot({ path: args.savePath, fullPage: false });

                    // Cleanup overlays
                    await this.page.evaluate(() => {
                        document.querySelectorAll('.nx-agent-cleanup, #nx-agent-style').forEach(el => el.remove());
                    });
                    return `Saved annotated screenshot to ${args.savePath}`;

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
