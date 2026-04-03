const os = require('os');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

/**
 * Nexus OS Tool: Browser Sub-agent
 * Provides web automation capabilities.
 */
class BrowserTool {
    constructor(profileDir = null) {
        this.browser = null;
        this.page = null;
        this.stopRequested = false;
        this.profileDir = profileDir || path.join(os.tmpdir(), `nexus-chrome-profile-${Date.now()}`);
    }

    async init(isMobile = false, mobileDevice = 'ios') {
        if (this.stopRequested) {
            return;
        }
        // Check if browser is disconnected
        if (this.browser && !this.browser.isConnected()) {
            console.log("[Browser] Detected disconnected browser, cleaning up...");
            this.browser = null;
            this.page = null;
        }

        if (!this.browser) {
            const isProd = process.env.NODE_ENV === 'production' || process.env.K_SERVICE;
            const headlessMode = process.env.BROWSER_HEADLESS === 'true' ? 'new' : false;
            console.log(`[Browser] Launching browser (prod=${isProd}, mobile=${isMobile})...`);
            fs.mkdirSync(this.profileDir, { recursive: true });
            const commonArgs = [
                '--ignore-certificate-errors',
                '--ignore-urlfetcher-cert-requests',
                '--disable-web-security',
                '--disable-extensions',           // Kill 'Testand' and all other extensions
                '--disable-default-apps',         // No default Chrome apps
                '--disable-popup-blocking',       // Allow all popups during automation
                '--disable-notifications',        // Block notification permission popups
                '--no-first-run',                 // Skip first-run dialogs
                '--no-default-browser-check',     // Skip default browser prompt
                '--disable-infobars',             // Hide "Chrome is being controlled" bar
                '--disable-blink-features=AutomationControlled', // Bypass bot detection
                `--user-data-dir=${this.profileDir}`             // Isolated profile (no personal extensions)
            ];

            this.browser = await puppeteer.launch({
                headless: headlessMode,
                ignoreHTTPSErrors: true,
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    ...commonArgs
                ]
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
        const stack = new Error().stack;
        console.log(`[Browser] Close requested. Current state: browser=${!!this.browser}, page=${!!this.page}.`);
        console.log(`[Browser] Shutdown Stack: ${stack.split('\n')[2].trim()}`);
        
        this.stopRequested = true;
        if (this.browser) {
            try {
                await this.browser.close();
            } catch (err) {
                console.error(`[Browser] Error during close: ${err.message}`);
            }
            this.browser = null;
            this.page = null;
        }
    }

    async stop() {
        await this.close();
    }

    async _describePageState() {
        if (!this.page || this.page.isClosed()) {
            return { url: null, title: null, readyState: 'no-page' };
        }
        try {
            return await this.page.evaluate(() => ({
                url: window.location.href,
                title: document.title,
                readyState: document.readyState,
                bodyTextPreview: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300)
            }));
        } catch (error) {
            return { url: null, title: null, readyState: `error: ${error.message}` };
        }
    }

    async _clickElement(selector, timeout = 10000) {
        await this.page.waitForSelector(selector, { visible: true, timeout });
        const element = await this.page.$(selector);
        if (!element) {
            throw new Error(`Element not found for selector: ${selector}`);
        }

        await element.evaluate((el) => {
            el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
        });

        const box = await element.boundingBox();
        if (box) {
            await this.page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2));
            await new Promise(r => setTimeout(r, 250));
        }

        await element.evaluate((el) => {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            el.click();
            if ((el.tagName === 'BUTTON' || (el.tagName === 'INPUT' && ['submit', 'button'].includes((el.type || '').toLowerCase()))) && el.form) {
                if (typeof el.form.requestSubmit === 'function') el.form.requestSubmit(el);
                else el.form.submit();
            }
        });

        await new Promise(r => setTimeout(r, 700));
    }

    async _setFieldValue(selector, text, timeout = 5000) {
        await this.page.waitForSelector(selector, { visible: true, timeout });
        await this.page.focus(selector);
        await this.page.$eval(selector, (el, value) => {
            if ('value' in el) {
                el.value = '';
                el.focus();
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }, text);
        await this.page.type(selector, text, { delay: 25 });
        await this.page.$eval(selector, (el) => {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        });
    }

    _normalizeSelector(selector) {
        const value = String(selector || '').trim();
        if (!value) return value;
        const containsMatch = value.match(/^([a-z0-9_-]+)\s*:\s*contains\((['"])(.*?)\2\)$/i);
        if (containsMatch) {
            return `::-p-text(${containsMatch[3]})`;
        }
        return value;
    }

    /**
     * Dispatcher for browser actions requested by the LLM
     */
    async executeAction(args) {
        this.stopRequested = false;
        if (!args || typeof args !== 'object') {
            return 'Error: browserAction requires an argument object.';
        }

        try {
            await this.init(args.isMobile, args.mobileDevice);
        } catch (error) {
            return `Error: Failed to launch browser. ${error.message}`;
        }

        if (this.stopRequested || !this.page || this.page.isClosed()) {
            return 'Error: Browser action cancelled because the Boss stopped the mission.';
        }

        const rawAction = String(args.action || '').trim();
        const action = rawAction === 'navigate'
            ? 'open'
            : rawAction === 'waitForSelector'
                ? 'waitForSelector'
                : (!rawAction && args.url ? 'open' : rawAction);
        try {
            switch (action) {
                case 'open':
                    if (!args.url) return 'Error: action=open requires url';
                    // Use networkidle2 for SPA support, with a longer timeout
                    const navOptions = { waitUntil: 'networkidle2', timeout: 60000 };
                    try {
                        console.log(`[Browser] Opening ${args.url} (waitUntil: networkidle2)...`);
                        await this.page.goto(args.url, navOptions);
                    } catch (navError) {
                        console.log(`[Browser] networkidle2 timeout, falling back to load: ${navError.message}`);
                        try {
                            await this.page.goto(args.url, { waitUntil: 'load', timeout: 30000 });
                        } catch (loadError) {
                            return `Error: Navigation failed to ${args.url} after multiple attempts. ${loadError.message}`;
                        }
                    }
                    return `Successfully opened ${args.url}. Page title: ${await this.page.title()}`;

                case 'click':
                    if (!args.selector) return 'Error: action=click requires selector';
                    {
                        const selector = this._normalizeSelector(args.selector);
                        await this._clickElement(selector, args.timeout || 10000);
                    }
                    return JSON.stringify({ ok: true, action, selector: args.selector, page: await this._describePageState() }, null, 2);

                case 'type':
                    if (!args.selector || !args.text) return 'Error: action=type requires selector and text';
                    await this.page.waitForSelector(args.selector, { visible: true, timeout: args.timeout || 10000 });
                    await this.page.focus(args.selector);
                    await this.page.type(args.selector, args.text, { delay: 50 });
                    return JSON.stringify({ ok: true, action, selector: args.selector, typed: true, page: await this._describePageState() }, null, 2);

                case 'clearAndType':
                    if (!args.selector || !args.text) return 'Error: action=clearAndType requires selector and text';
                    {
                        const selector = this._normalizeSelector(args.selector);
                        await this._setFieldValue(selector, args.text, args.timeout || 5000);
                    }
                    return JSON.stringify({ ok: true, action, selector: args.selector, typed: true, cleared: true, page: await this._describePageState() }, null, 2);

                case 'focus':
                    if (!args.selector) return 'Error: action=focus requires selector';
                    await this.page.waitForSelector(args.selector, { timeout: 5000 });
                    await this.page.focus(args.selector);
                    return JSON.stringify({ ok: true, action, selector: args.selector, page: await this._describePageState() }, null, 2);

                case 'keyPress':
                    if (!args.key) return 'Error: action=keyPress requires key (e.g., "Enter")';
                    await this.page.keyboard.press(args.key);
                    return `Successfully pressed key: ${args.key}`;
                
                case 'clickPixel':
                    if (args.x === undefined || args.y === undefined) return 'Error: action=clickPixel requires x and y';
                    await this.page.mouse.click(args.x, args.y);
                    return JSON.stringify({ ok: true, action, x: args.x, y: args.y, page: await this._describePageState() }, null, 2);

                case 'hover':
                    if (args.selector) {
                        await this.page.waitForSelector(args.selector, { timeout: 5000 });
                        await this.page.hover(args.selector);
                        return `Successfully hovered over selector: ${args.selector}`;
                    } else if (args.x !== undefined && args.y !== undefined) {
                        await this.page.mouse.move(args.x, args.y);
                        return `Successfully hovered at pixel (${args.x}, ${args.y})`;
                    }
                    return 'Error: action=hover requires selector OR x and y';

                case 'scroll':
                    if (args.direction === 'up') {
                        await this.page.evaluate(() => window.scrollBy(0, -500));
                        return `Scrolled up.`;
                    } else if (args.direction === 'down') {
                        await this.page.evaluate(() => window.scrollBy(0, 500));
                        return `Scrolled down.`;
                    } else if (args.selector) {
                        await this.page.waitForSelector(args.selector, { timeout: 5000 });
                        await this.page.$eval(args.selector, el => el.scrollIntoView());
                        return `Scrolled to selector: ${args.selector}`;
                    }
                    return 'Error: action=scroll requires direction ("up"/"down") OR selector';


                case 'waitForNetworkIdle':
                    const timeout = args.timeout || 15000;
                    try {
                        await this.page.waitForNetworkIdle({ idleTime: 1000, timeout: timeout });
                        return JSON.stringify({ ok: true, action, timeout, idle: true, page: await this._describePageState() }, null, 2);
                    } catch (err) {
                        return JSON.stringify({ ok: false, action, timeout, idle: false, classification: 'timeout', page: await this._describePageState(), error: err.message }, null, 2);
                    }

                case 'waitForSelector':
                    if (!args.selector) return 'Error: action=waitForSelector requires selector';
                    try {
                        const selector = this._normalizeSelector(args.selector);
                        await this.page.waitForSelector(selector, { timeout: args.timeout || 10000 });
                        return JSON.stringify({ ok: true, action, selector: args.selector, found: true, page: await this._describePageState() }, null, 2);
                    } catch (err) {
                        return JSON.stringify({ ok: false, action, selector: args.selector, found: false, classification: 'timeout', page: await this._describePageState(), error: err.message }, null, 2);
                    }

                case 'clickText':
                    if (!args.text) return 'Error: action=clickText requires text';
                    try {
                        // Use Puppeteer's built-in text selector which finds the deepest matching element
                        const safeText = String(args.text).replace(/[\\()]/g, '\\$&');
                        const selector = `::-p-text(${safeText})`;
                        await this._clickElement(selector, args.timeout || 10000);
                        return JSON.stringify({ ok: true, action, text: args.text, page: await this._describePageState() }, null, 2);
                    } catch (err) {
                        return JSON.stringify({ ok: false, action, text: args.text, error: err.message, classification: 'interaction_failure', page: await this._describePageState() }, null, 2);
                    }

                case 'extract':
                    if (!args.selector) return 'Error: action=extract requires selector';
                    let textContent = '';
                    {
                        const selector = this._normalizeSelector(args.selector);
                        await this.page.waitForSelector(selector, { timeout: 5000 });
                        textContent = await this.page.$eval(selector, el => el.innerText || el.textContent || '');
                    }
                    return JSON.stringify({ ok: true, action, selector: args.selector, text: textContent, page: await this._describePageState() }, null, 2);

                case 'getMarkdown':
                    // Returns a structured Markdown representation of the page for LLM clarity
                    return await this.page.evaluate(() => {
                        function isVisible(el) {
                            const style = window.getComputedStyle(el);
                            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && el.offsetWidth > 0 && el.offsetHeight > 0;
                        }

                        let idCounter = 0;
                        function processNode(node) {
                            if (node.nodeType === Node.TEXT_NODE) {
                                return node.textContent.trim();
                            }
                            if (node.nodeType !== Node.ELEMENT_NODE || !isVisible(node)) return "";

                            const tag = node.tagName.toLowerCase();
                            if (['script', 'style', 'noscript', 'svg'].includes(tag)) return "";

                            let childrenText = Array.from(node.childNodes).map(processNode).filter(t => t).join(" ");
                            
                            // Assign/retrieve ID for interactables
                            const isInteractive = ['a', 'button', 'input', 'select', 'textarea', 'label'].includes(tag) || 
                                                 node.hasAttribute('role') || node.hasAttribute('onclick') || 
                                                 (node.classList && node.classList.contains('v-label--clickable'));
                            
                            if (isInteractive) {
                                if (!node.id) node.id = `nexus-autoid-${idCounter++}`;
                                const typeStr = node.type ? ` (${node.type})` : "";
                                return `\n[${childrenText || tag}${typeStr}](#${node.id})\n`;
                            }

                            if (/^h[1-6]$/.test(tag)) {
                                return `\n${'#'.repeat(parseInt(tag[1]))} ${childrenText}\n`;
                            }
                            if (tag === 'p') return `\n${childrenText}\n`;
                            if (tag === 'li') return `* ${childrenText}\n`;

                            return childrenText;
                        }

                        const md = processNode(document.body);
                        return md.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
                    });

                case 'extractActiveElements':
                    // 1. Wait for page stability
                    try {
                        console.log("[Browser] Waiting for network idle before extraction...");
                        await this.page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 });
                    } catch (e) {
                         console.log("[Browser] Network did not become idle, proceeding with extraction anyway.");
                    }
                    
                    // 2. Wait for body to be present and have some content
                    await this.page.waitForSelector('body', { timeout: 5000 });
                    
                    // 3. Briefly wait for any final JS rendering
                    await new Promise(r => setTimeout(r, 1500));

                    return await this.page.evaluate(() => {
                        const interactables = Array.from(document.querySelectorAll('a, button, input, select, textarea, label, [role="button"], [role="link"], [role="menuitem"], [onclick], [tabindex]:not([tabindex="-1"]), span, div'));
                        const visibleElements = interactables.filter(el => {
                            const style = window.getComputedStyle(el);
                            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && el.offsetWidth > 0 && el.offsetHeight > 0;
                        });

                        const parsedElements = visibleElements.map((el, index) => {
                            // Assign a unique ID if it doesn't have one to make targeting easy
                            if (!el.id) el.id = `nexus-autoid-${index}`;

                            const rect = el.getBoundingClientRect();
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
                                rect: {
                                    x: Math.round(rect.left + window.scrollX),
                                    y: Math.round(rect.top + window.scrollY),
                                    w: Math.round(rect.width),
                                    h: Math.round(rect.height)
                                },
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
                                label.innerText = el.id ? el.id : ('nexus-autoid-' + index);
                                if (!el.id) el.id = 'nexus-autoid-' + index;

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
            const pageState = await this._describePageState();
            return JSON.stringify({
                ok: false,
                action,
                error: error.message,
                classification: /timeout/i.test(error.message) ? 'timeout' : 'interaction_failure',
                page: pageState
            }, null, 2);
        }
    }
}

module.exports = BrowserTool;
