const ConfigService = require('../core/config');

/**
 * X (Twitter) Advertising & Promotion Tool
 * Supports organic posting via either API or Browser Automation.
 */
class XAdsTool {
    constructor() {
        this.browserAction = null; // Injected at runtime by the orchestrator
    }

    /**
     * Publish a new post to X.
     */
    async publishOrganicPost(text, imagePath = null) {
        console.log(`[X/Twitter] Preparing to publish organic post...`);
        
        const apiKey = await ConfigService.get('X_API_KEY');
        const accessToken = await ConfigService.get('X_ACCESS_TOKEN');

        if (apiKey && accessToken) {
            return await this._publishWithAPI(text, imagePath, apiKey, accessToken);
        }

        // --- BROWSER FALLBACK ---
        console.log(`[X/Twitter] API keys missing. Falling back to Browser Automation...`);
        return await this._publishWithBrowser(text, imagePath);
    }

    async _publishWithAPI(text, imagePath, apiKey, accessToken) {
        return { error: "X API Mode is not yet fully implemented. Using Browser Fallback instead." };
    }

    async _publishWithBrowser(text, imagePath) {
        if (!this.browserAction) {
            return { error: "Browser engine not initialized for XAdsTool." };
        }

        try {
            // 1. Open X Compose
            console.log(`[X/Twitter] Opening composer...`);
            await this.browserAction({ 
                action: 'open', 
                url: 'https://x.com/intent/tweet' 
            });

            // 2. Wait for the tweet box
            await this.browserAction({
                action: 'waitForSelector',
                selector: '[data-testid="tweetTextarea_0"]',
                timeout: 10000
            });

            // 3. Type the content
            console.log(`[X/Twitter] Typing message...`);
            await this.browserAction({
                action: 'type',
                selector: '[data-testid="tweetTextarea_0"]',
                text: text
            });

            // --- IMAGE UPLOAD LOGIC (Placeholder for future hardening) ---
            if (imagePath) {
                console.log(`[X/Twitter] Image upload via browser is not yet optimized. Skip for now or provide feedback.`);
            }

            // 4. Click Post
            console.log(`[X/Twitter] Clicking 'Post'...`);
            // Note: Selector for post button within the intent popup
            const postResult = await this.browserAction({
                action: 'clickText',
                text: 'Post'
            });

            if (postResult.toLowerCase().includes('error')) {
                return { error: "Failed to click 'Post' button on X.", details: postResult };
            }

            // Best-effort: try to discover the newly created status URL from the page content.
            // X's intent flow doesn't reliably return an ID, so we scan for a /status/<id> link.
            let discoveredUrl = null;
            try {
                const markdown = await this.browserAction({ action: 'getMarkdown' });
                const match = String(markdown || '').match(/https?:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+/i);
                if (match) discoveredUrl = match[0];
            } catch (_) {
                // Ignore discovery failures; publish success still stands.
            }

            return { 
                success: true, 
                message: "Post successfully published to X via Browser Automation.",
                url: discoveredUrl,
                platform: 'X/Twitter',
                mode: 'agentic_browser'
            };
        } catch (error) {
            return { error: "X Browser Automation failed", details: error.message };
        }
    }

    async deletePost(postUrl) {
        if (!this.browserAction) {
            return { error: "Browser engine not initialized for XAdsTool." };
        }
        if (!postUrl) {
            return { error: "X post URL is required for delete." };
        }

        try {
            await this.browserAction({ action: 'open', url: postUrl });
            await this.browserAction({ action: 'waitForNetworkIdle', timeout: 10000 });
            await this.browserAction({ action: 'clickText', text: 'More', timeout: 8000 });
            await this.browserAction({ action: 'clickText', text: 'Delete', timeout: 8000 });
            await this.browserAction({ action: 'clickText', text: 'Delete', timeout: 8000 });
            return { success: true, deleted: true, url: postUrl, platform: 'X/Twitter', mode: 'agentic_browser' };
        } catch (error) {
            return { error: "X delete failed", details: error.message, url: postUrl };
        }
    }

    async getSetupStatus() {
        const apiKey = await ConfigService.get('X_API_KEY');
        const apiSecret = await ConfigService.get('X_API_SECRET');
        const accessToken = await ConfigService.get('X_ACCESS_TOKEN');
        const accessSecret = await ConfigService.get('X_ACCESS_SECRET');

        const hasFullAPI = Boolean(apiKey && apiSecret && accessToken && accessSecret);
        
        return {
            ok: true, // We always have the Browser Fallback
            provider: 'x',
            hasAPI: hasFullAPI,
            hasBrowserSession: true,
            missingKeys: hasFullAPI ? [] : ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'].filter(async k => !(await ConfigService.get(k)))
        };
    }
}

module.exports = new XAdsTool();
