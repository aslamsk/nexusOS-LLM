const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Meta Ads Automation Tool
 * Interfaces with the Meta Graph API to manage campaigns, ad sets, and creatives.
 */
class MetaAdsTool {
    constructor() {
        this.accessToken = process.env.META_ACCESS_TOKEN;
        this.adAccountId = process.env.META_AD_ACCOUNT_ID; // Format: act_<AD_ACCOUNT_ID>
        if (this.adAccountId && !this.adAccountId.startsWith('act_')) {
            this.adAccountId = 'act_' + this.adAccountId;
        }
        this.apiVersion = 'v19.0';
    }

    /**
     * Helper to make API requests to Meta Graph
     */
    async _request(method, endpoint, data = {}) {
        // Reload environment variables to catch dynamic updates in .env
        require('dotenv').config();
        this.accessToken = process.env.META_ACCESS_TOKEN;
        this.adAccountId = process.env.META_AD_ACCOUNT_ID;
        if (this.adAccountId && !this.adAccountId.startsWith('act_')) {
            this.adAccountId = 'act_' + this.adAccountId;
        }

        if (!this.accessToken || !this.adAccountId) {
            return { error: "Meta API credentials missing. You MUST call askUserForInput to ask the user to provide their META_ACCESS_TOKEN and META_AD_ACCOUNT_ID" };
        }

        const url = `https://graph.facebook.com/${this.apiVersion}/${endpoint}`;
        const queryParams = new URLSearchParams({ access_token: this.accessToken, ...data }).toString();
        const fullUrl = method === 'GET' ? `${url}?${queryParams}` : `${url}?access_token=${this.accessToken}`;

        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(fullUrl, options, (res) => {
                let responseBody = '';
                res.on('data', (chunk) => responseBody += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(responseBody);
                        if (json.error) {
                            console.error(`[MetaAds] API Error Details:`, JSON.stringify(json.error, null, 2));
                            resolve({ error: json.error.message, details: json.error });
                        } else {
                            resolve(json);
                        }
                    } catch (e) {
                        resolve({ error: "Failed to parse Meta API response" });
                    }
                });
            });

            req.on('error', (err) => reject(err));
            if (method !== 'GET') {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    /**
     * Create a new Ad Campaign
     */
    async createCampaign(name, objective = 'OUTCOME_TRAFFIC', status = 'PAUSED') {
        console.log(`[MetaAds] Creating campaign: ${name}...`);
        const endpoint = `${this.adAccountId}/campaigns`;
        return await this._request('POST', endpoint, {
            name: name,
            objective: objective,
            status: status,
            special_ad_categories: ['NONE'],
            is_adset_budget_sharing_enabled: false
        });
    }

    /**
     * Create an Ad Set within a campaign
     */
    async createAdSet(campaignId, name, dailyBudget, targeting = {}) {
        console.log(`[MetaAds] Creating ad set: ${name} in campaign ${campaignId}...`);
        const endpoint = `${this.adAccountId}/adsets`;

        // --- Normalization ---
        // 1. Budget: Meta expects integers in the smallest currency unit (e.g., paise for INR)
        const normalizedBudget = Math.round(parseFloat(dailyBudget) * 100);

        // 2. Targeting: Ensure geo_locations is valid
        let cleanTargeting = { ...targeting };
        if (!cleanTargeting.geo_locations || !Object.keys(cleanTargeting.geo_locations).length) {
            console.log('[MetaAds] No locations found, defaulting to India.');
            cleanTargeting.geo_locations = { countries: ['IN'] };
        }

        // 3. Interests: Meta ONLY accepts IDs or specific objects. Strings cause errors.
        if (cleanTargeting.interests) {
            if (!Array.isArray(cleanTargeting.interests)) {
                delete cleanTargeting.interests;
            } else {
                // Filter out raw strings, only allow objects with {id: '...'}
                cleanTargeting.interests = cleanTargeting.interests.filter(i => typeof i === 'object' && i.id);
                if (cleanTargeting.interests.length === 0) delete cleanTargeting.interests;
            }
        }

        return await this._request('POST', endpoint, {
            name: name,
            campaign_id: campaignId,
            daily_budget: normalizedBudget,
            targeting: cleanTargeting,
            billing_event: 'IMPRESSIONS',
            optimization_goal: 'LINK_CLICKS',
            status: 'PAUSED',
            bid_strategy: 'LOWEST_COST_WITHOUT_CAP'
        });
    }

    /**
     * Get Ad Account Information (to check currency, business_id, etc.)
     */
    async getAccountInfo() {
        console.log(`[MetaAds] Fetching account info: ${this.adAccountId}...`);
        return await this._request('GET', this.adAccountId, { fields: 'name,currency,business' });
    }

    /**
     * Upload an image to the AD Account library
     */
    async uploadImage(imagePath) {
        console.log(`[MetaAds] Uploading image: ${imagePath}...`);
        const endpoint = `${this.adAccountId}/adimages`;

        // Dynamic reload
        require('dotenv').config();
        const token = process.env.META_ACCESS_TOKEN;
        if (!token) {
            return { error: "Meta API token missing. You MUST call askUserForInput to ask the user to provide their META_ACCESS_TOKEN." };
        }

        // Use spawnSync for robust multipart/form-data upload of local file
        const { spawnSync } = require('child_process');
        try {
            const args = [
                '-s',
                '-X', 'POST',
                `https://graph.facebook.com/${this.apiVersion}/${this.adAccountId}/adimages`,
                '-F', `access_token=${token}`,
                '-F', `filename=@${imagePath}`
            ];

            console.log(`[MetaAds] Running: curl ${args.join(' ').substring(0, 50)}...`);
            const result = spawnSync('curl', args);

            if (result.error) {
                return { error: "Spawn failed", details: result.error.message };
            }

            const output = result.stdout.toString();
            const res = JSON.parse(output);
            if (res.images && res.images[Object.keys(res.images)[0]]) {
                return res.images[Object.keys(res.images)[0]]; // Returns { hash: '...', url: '...' }
            }
            return res;
        } catch (e) {
            return { error: "Image upload failed via spawnSync", details: e.message };
        }
    }

    /**
     * Create an Ad Creative
     */
    async createAdCreative(name, title, body, imageHash, pageId, cta = 'SHOP_NOW') {
        // Fallback to .env for Page ID if not provided by LLM
        require('dotenv').config();
        const activePageId = pageId || process.env.META_PAGE_ID;

        console.log(`[MetaAds] Creating ad creative: ${name} for Page ${activePageId} with CTA ${cta}...`);
        const endpoint = `${this.adAccountId}/adcreatives`;

        if (!imageHash || imageHash.includes('/') || imageHash.includes('\\')) {
            return { error: "Invalid image hash. Please use 'metaUploadImage' first to get a valid hash." };
        }

        if (!activePageId) {
            return { error: "Missing Page ID. You MUST call askUserForInput to ask the user to provide their META_PAGE_ID." };
        }

        return await this._request('POST', endpoint, {
            name: name,
            object_story_spec: {
                page_id: activePageId,
                link_data: {
                    image_hash: imageHash,
                    link: 'https://mkfashion.in', // Default to site
                    message: body,
                    name: title,
                    call_to_action: { type: cta }
                }
            }
        });
    }

    /**
     * Organic Video Post (FREE): Post a video to the Facebook Page feed
     */
    async publishPageVideo(pageId, title, description, videoPath, isReel = false) {
        require('dotenv').config();
        const activePageId = pageId || process.env.META_PAGE_ID;
        console.log(`[MetaAds] Preparing organic ${isReel ? 'Reel' : 'video'} post to Page ${activePageId}...`);
        
        const pageToken = await this._getPageToken(activePageId);
        const token = pageToken || this.accessToken;

        return new Promise((resolve) => {
            const boundary = `----NexusOSBoundary${Math.random().toString(16).substring(2)}`;
            const url = `https://graph.facebook.com/${this.apiVersion}/${activePageId}/videos`;
            
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                }
            };

            const req = https.request(url, options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve({ error: "Failed to parse upload response", output: data });
                    }
                });
            });

            req.on('error', (err) => resolve({ error: "Upload request failed", details: err.message }));

            // Manually build multipart body for zero-dependency consistency
            const fileContent = fs.readFileSync(videoPath);
            const filename = path.basename(videoPath);

            req.write(`--${boundary}\r\n`);
            req.write(`Content-Disposition: form-data; name="access_token"\r\n\r\n${token}\r\n`);
            
            req.write(`--${boundary}\r\n`);
            req.write(`Content-Disposition: form-data; name="title"\r\n\r\n${title}\r\n`);
            
            req.write(`--${boundary}\r\n`);
            req.write(`Content-Disposition: form-data; name="description"\r\n\r\n${description}\r\n`);

            if (isReel) {
                req.write(`--${boundary}\r\n`);
                req.write(`Content-Disposition: form-data; name="media_to_be_posted_as_reel"\r\n\r\ntrue\r\n`);
            }

            req.write(`--${boundary}\r\n`);
            req.write(`Content-Disposition: form-data; name="source"; filename="${filename}"\r\n`);
            req.write(`Content-Type: video/mp4\r\n\r\n`);
            req.write(fileContent);
            req.write(`\r\n--${boundary}--\r\n`);
            
            req.end();
        });
    }

    /**
     * Organic Reel (FREE): Post a Reel to the Facebook Page
     */
    async publishPageReel(pageId, description, videoPath) {
        return await this.publishPageVideo(pageId, "Reel", description, videoPath, true);
    }

    /**
     * Final step: Create the Ad
     */
    async createAd(adSetId, creativeId, name) {
        console.log(`[MetaAds] Creating ad: ${name} in ad set ${adSetId}...`);
        const endpoint = `${this.adAccountId}/ads`;
        return await this._request('POST', endpoint, {
            name: name,
            adset_id: adSetId,
            creative: { creative_id: creativeId },
            status: 'PAUSED'
        });
    }

    /**
     * Helper to get a Page Access Token using the User Access Token
     */
    async _getPageToken(pageId) {
        console.log(`[MetaAds] Exchanging User Token for Page Token (${pageId})...`);
        const res = await this._request('GET', `${pageId}`, { fields: 'access_token' });
        if (res.access_token) {
            return res.access_token;
        }
        console.warn(`[MetaAds] Failed to get Page Token: ${JSON.stringify(res)}`);
        return null; // Fallback to User Token
    }

    /**
     * Organic Post (FREE): Post directly to the Facebook Page feed
     */
    async publishPagePost(pageId, message, link = '') {
        require('dotenv').config();
        const activePageId = pageId || process.env.META_PAGE_ID;
        console.log(`[MetaAds] Preparing organic post to Page ${activePageId}...`);
        
        // --- CRITICAL: Meta requires a Page Access Token for organic posting ---
        const pageToken = await this._getPageToken(activePageId);
        
        const endpoint = `${activePageId}/feed`;
        return await this._request('POST', endpoint, {
            message: message,
            link: link,
            access_token: pageToken || this.accessToken // Override with Page Token if found
        });
    }

    /**
     * Organic Photo Post (FREE): Post a photo to the Facebook Page feed
     */
    async publishPagePhoto(pageId, message, imagePath) {
        require('dotenv').config();
        const activePageId = pageId || process.env.META_PAGE_ID;
        console.log(`[MetaAds] Preparing organic photo post to Page ${activePageId}...`);
        
        const pageToken = await this._getPageToken(activePageId);
        const endpoint = `${activePageId}/photos`;
        
        const { spawnSync } = require('child_process');
        try {
            const args = [
                '-s',
                '-X', 'POST',
                `https://graph.facebook.com/${this.apiVersion}/${endpoint}`,
                '-F', `access_token=${pageToken || this.accessToken}`,
                '-F', `message=${message}`,
                '-F', `source=@${imagePath}`
            ];
            
            console.log(`[MetaAds] Running: curl photo post to ${activePageId}...`);
            const result = spawnSync('curl', args);
            const output = result.stdout.toString();
            try {
                return JSON.parse(output);
            } catch (e) {
                return { error: "Failed to parse photo response", output: output };
            }
        } catch (e) {
            return { error: "Photo post failed via spawnSync", details: e.message };
        }
    }

    /**
     * Verify the current Meta Access Token
     */
    async verifyToken() {
        console.log(`[MetaAds] Verifying current access token...`);
        try {
            const result = await this.getAccountInfo();
            if (result.error) return { valid: false, error: result.error };
            return { valid: true, account: result.id };
        } catch (e) {
            return { valid: false, error: e.message };
        }
    }

    /**
     * Get comments for a specific object (Post, Ad, etc.)
     */
    async getComments(objectId) {
        console.log(`[MetaAds] Fetching comments for ${objectId}...`);
        const pageToken = await this._getPageToken(process.env.META_PAGE_ID);
        return await this._request('GET', `${objectId}/comments`, {
            access_token: pageToken || this.accessToken
        });
    }

    /**
     * Reply to a comment
     */
    async replyToComment(commentId, message) {
        console.log(`[MetaAds] Replying to comment ${commentId}...`);
        const pageToken = await this._getPageToken(process.env.META_PAGE_ID);
        return await this._request('POST', `${commentId}/comments`, {
            message: message,
            access_token: pageToken || this.accessToken
        });
    }

    /**
     * Get Page Engagement Insights
     */
    async getPageInsights(pageId) {
        require('dotenv').config();
        const activePageId = pageId || process.env.META_PAGE_ID;
        console.log(`[MetaAds] Fetching insights for Page ${activePageId}...`);
        
        const pageToken = await this._getPageToken(activePageId);
        const endpoint = `${activePageId}/insights`;
        
        return await this._request('GET', endpoint, {
            metric: 'page_impressions_unique,page_post_engagements,page_views_total',
            period: 'day',
            access_token: pageToken || this.accessToken
        });
    }
}

module.exports = new MetaAdsTool();
