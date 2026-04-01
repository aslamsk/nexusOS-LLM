const ConfigService = require('../core/config');
const { db } = require('../core/firebase');
const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Meta Ads Automation Tool
 * Interfaces with the Meta Graph API to manage campaigns, ad sets, and creatives.
 */
class MetaAdsTool {
    constructor() {
        this.apiVersion = 'v19.0';
    }

    _sanitizeAccessToken(value) {
        const raw = String(value ?? '').trim();
        if (!raw) return '';
        const prefixed = raw.match(/(?:access\s*token\s*:?\s*)(EAA[\w]+)/i);
        if (prefixed && prefixed[1]) {
            return prefixed[1].trim();
        }
        return raw;
    }

    async _getAdAccountId() {
        let adAccountId = await ConfigService.get('META_AD_ACCOUNT_ID');
        if (this._isBlankValue(adAccountId)) {
            return null;
        }
        adAccountId = String(adAccountId).trim();
        return adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    }

    async _getInstagramBusinessAccountId() {
        const accountId = await ConfigService.get('INSTAGRAM_BUSINESS_ACCOUNT_ID') || await ConfigService.get('META_INSTAGRAM_BUSINESS_ACCOUNT_ID');
        if (this._isBlankValue(accountId)) return null;
        return String(accountId).trim();
    }

    _isBlankValue(value) {
        const normalized = String(value ?? '').trim().toLowerCase();
        return !normalized || ['null', 'undefined', 'none', 'n/a', 'na'].includes(normalized);
    }

    /**
     * Set and persist Meta credentials to the .env file.
     */
    async setCredentials(accessToken, adAccountId, pageId) {
        console.log(`[MetaAds] Persisting new credentials to Cloud Firestore...`);
        
        if (!db) return "Error: Firebase Firestore not initialized.";

        const updates = {};
        const cleanedAccessToken = this._sanitizeAccessToken(accessToken);
        if (cleanedAccessToken) updates['META_ACCESS_TOKEN'] = cleanedAccessToken;
        if (adAccountId) updates['META_AD_ACCOUNT_ID'] = adAccountId;
        if (pageId) updates['META_PAGE_ID'] = pageId;

        try {
            const executionContext = typeof ConfigService.getExecutionContext === 'function'
                ? ConfigService.getExecutionContext()
                : { strict: false, clientId: null, hasOverrides: false };
            const isClientScoped = Boolean(executionContext.strict && executionContext.clientId);
            const collection = isClientScoped ? 'client_configs' : 'configs';
            const docId = isClientScoped ? executionContext.clientId : 'default';

            await db.collection(collection).doc(docId).set(updates, { merge: true });

            if (isClientScoped) {
                const mergedOverrides = {
                    ...(ConfigService.clientOverrides || {}),
                    ...updates
                };
                ConfigService.setClientOverrides(mergedOverrides, {
                    strict: true,
                    clientId: executionContext.clientId
                });
            } else {
                ConfigService.refresh(); // Invalidate cache for default/global mode
            }

            return `Meta credentials successfully updated in Firestore${isClientScoped ? ` for client ${executionContext.clientId}` : ''}.`;
        } catch (error) {
            return `Error updating Firestore: ${error.message}`;
        }
    }

    /**
     * Helper to make API requests to Meta Graph
     */
    async _request(method, endpoint, data = {}) {
        const payload = { ...(data || {}) };
        const explicitAccessToken = this._sanitizeAccessToken(payload.access_token);
        if (payload.access_token) {
            delete payload.access_token;
        }

        const configAccessToken = this._sanitizeAccessToken(await ConfigService.get('META_ACCESS_TOKEN'));
        const accessToken = explicitAccessToken || configAccessToken;

        if (!accessToken) {
            return { error: "Meta API access token missing. Use 'metaSetCredentials' or update the active client/default configuration." };
        }

        const url = `https://graph.facebook.com/${this.apiVersion}/${endpoint}`;
        const queryParams = new URLSearchParams({ access_token: accessToken, ...payload }).toString();
        const fullUrl = method === 'GET' ? `${url}?${queryParams}` : `${url}?access_token=${accessToken}`;

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
                req.write(JSON.stringify(payload));
            }
            req.end();
        });
    }

    /**
     * Create a new Ad Campaign
     */
    async createCampaign(name, objective = 'OUTCOME_TRAFFIC', status = 'PAUSED') {
        console.log(`[MetaAds] Creating campaign: ${name}...`);
        const adAccountId = await this._getAdAccountId();
        if (!adAccountId) {
            return { error: "Missing META_AD_ACCOUNT_ID in Firestore." };
        }
        const endpoint = `${adAccountId}/campaigns`;
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
        const adAccountId = await this._getAdAccountId();
        if (!adAccountId) {
            return { error: "Missing META_AD_ACCOUNT_ID in Firestore." };
        }
        const endpoint = `${adAccountId}/adsets`;

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
        const adAccountId = await this._getAdAccountId();
        if (!adAccountId) {
            return { error: "Missing META_AD_ACCOUNT_ID in Firestore." };
        }
        console.log(`[MetaAds] Fetching account info: ${adAccountId}...`);
        return await this._request('GET', adAccountId, { fields: 'name,currency,business' });
    }

    /**
     * Helper to download remote media to a local temp file
     */
    async _resolveMedia(pathOrUrl) {
        if (!pathOrUrl || !pathOrUrl.startsWith('http')) return pathOrUrl;
        
        console.log(`[MetaAds] Downloading remote media: ${pathOrUrl.substring(0, 50)}...`);
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const tmppath = path.join(os.tmpdir(), `meta_dl_${Date.now()}.bin`);
        
        return new Promise((resolve, reject) => {
            const lib = pathOrUrl.startsWith('https') ? require('https') : require('http');
            lib.get(pathOrUrl, (res) => {
                const file = fs.createWriteStream(tmppath);
                res.pipe(file);
                file.on('finish', () => { file.close(); resolve(tmppath); });
            }).on('error', (err) => {
                fs.unlink(tmppath, () => {});
                reject(err);
            });
        });
    }

    /**
     * Upload an image to the AD Account library
     */
    async uploadImage(imagePathRaw) {
        const imagePath = await this._resolveMedia(imagePathRaw);
        console.log(`[MetaAds] Uploading image: ${imagePath}...`);
        const adAccountId = await this._getAdAccountId();
        if (!adAccountId) {
            return { error: "Missing META_AD_ACCOUNT_ID in Firestore." };
        }
        const endpoint = `${adAccountId}/adimages`;

        const token = await ConfigService.get('META_ACCESS_TOKEN');
        if (!token) {
            return { error: "Meta API token missing in Firestore. Use 'metaSetCredentials' or update the 'configs/default' collection." };
        }

        // Use spawnSync for robust multipart/form-data upload of local file
        const { spawnSync } = require('child_process');
        try {
            const args = [
                '-s',
                '-X', 'POST',
                `https://graph.facebook.com/${this.apiVersion}/${adAccountId}/adimages`,
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
    async createAdCreative(name, title, body, imageHash, pageId, cta = 'SHOP_NOW', link = '') {
        const activePageId = pageId || await ConfigService.get('META_PAGE_ID');

        console.log(`[MetaAds] Creating ad creative: ${name} for Page ${activePageId} with CTA ${cta}...`);
        const adAccountId = await this._getAdAccountId();
        if (!adAccountId) {
            return { error: "Missing META_AD_ACCOUNT_ID in Firestore." };
        }
        const endpoint = `${adAccountId}/adcreatives`;

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
                    link: this._isBlankValue(link) ? 'https://example.com' : link,
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
    async publishPageVideo(pageId, title, description, videoPathRaw, isReel = false) {
        require('dotenv').config();
        const videoPath = await this._resolveMedia(videoPathRaw);
        const activePageId = pageId || process.env.META_PAGE_ID;
        console.log(`[MetaAds] Preparing organic ${isReel ? 'Reel' : 'video'} post to Page ${activePageId}...`);
        
        const pageToken = await this._getPageToken(activePageId);
        const token = pageToken || await ConfigService.get('META_ACCESS_TOKEN');

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
        const adAccountId = await this._getAdAccountId();
        if (!adAccountId) {
            return { error: "Missing META_AD_ACCOUNT_ID in Firestore." };
        }
        const endpoint = `${adAccountId}/ads`;
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
        const activePageId = pageId || await ConfigService.get('META_PAGE_ID');
        if (this._isBlankValue(activePageId)) {
            return { error: 'Missing Page ID for organic post.' };
        }
        if (this._isBlankValue(message)) {
            return { error: 'Missing message for organic post.' };
        }
        console.log(`[MetaAds] Preparing organic post to Page ${activePageId}...`);
        
        // --- CRITICAL: Meta requires a Page Access Token for organic posting ---
        const pageToken = await this._getPageToken(activePageId);
        
        const endpoint = `${activePageId}/feed`;
        return await this._request('POST', endpoint, {
            message: message,
            link: this._isBlankValue(link) ? '' : link,
            access_token: pageToken || await ConfigService.get('META_ACCESS_TOKEN') // Override with Page Token if found
        });
    }


    /**
     * Organic Photo Post (FREE): Post a photo to the Facebook Page feed
     */
    async publishPagePhoto(pageId, message, imagePathRaw) {
        let imagePath = await this._resolveMedia(imagePathRaw);
        // --- Windows path normalization for curl ---
        if (imagePath && typeof imagePath === 'string') {
            imagePath = imagePath.replace(/\\/g, '/');
        }
        
        const activePageId = pageId || await ConfigService.get('META_PAGE_ID');
        if (this._isBlankValue(activePageId)) {
            return { error: 'Missing Page ID for photo post.' };
        }
        
        console.log(`[MetaAds] Preparing organic photo post to Page ${activePageId}...`);
        const pageToken = await this._getPageToken(activePageId);
        const token = pageToken || await ConfigService.get('META_ACCESS_TOKEN');

        return new Promise((resolve) => {
            const boundary = `----NexusOSBoundary${Math.random().toString(16).substring(2)}`;
            const url = `https://graph.facebook.com/${this.apiVersion}/${activePageId}/photos`;
            
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
                        const parsed = JSON.parse(data);
                        if (parsed.error) {
                            resolve({ error: parsed.error.message || 'Meta Graph API error', details: parsed.error });
                        } else {
                            resolve(parsed);
                        }
                    } catch (e) {
                        resolve({ error: "Failed to parse upload response", output: data });
                    }
                });
            });

            req.on('error', (err) => resolve({ error: "Upload request failed", details: err.message }));

            // Build multipart body
            const fileContent = fs.readFileSync(imagePath);
            const filename = path.basename(imagePath);

            req.write(`--${boundary}\r\n`);
            req.write(`Content-Disposition: form-data; name="access_token"\r\n\r\n${token}\r\n`);
            
            req.write(`--${boundary}\r\n`);
            req.write(`Content-Disposition: form-data; name="message"\r\n\r\n${message}\r\n`);
            
            req.write(`--${boundary}\r\n`);
            req.write(`Content-Disposition: form-data; name="source"; filename="${filename}"\r\n`);
            req.write(`Content-Type: image/png\r\n\r\n`);
            req.write(fileContent);
            req.write(`\r\n--${boundary}--\r\n`);
            
            req.end();
        });
    }

    async publishInstagramPhoto(message, imagePathRaw) {
        const imageUrl = /^https?:\/\//i.test(String(imagePathRaw || ''))
            ? String(imagePathRaw).trim()
            : await this._resolveMedia(imagePathRaw);
        const igUserId = await this._getInstagramBusinessAccountId();
        const accessToken = await ConfigService.get('META_ACCESS_TOKEN');

        if (this._isBlankValue(igUserId)) {
            return { error: 'Missing INSTAGRAM_BUSINESS_ACCOUNT_ID for Instagram publish.' };
        }
        if (this._isBlankValue(accessToken)) {
            return { error: 'Missing META_ACCESS_TOKEN for Instagram publish.' };
        }
        if (this._isBlankValue(message)) {
            return { error: 'Missing message for Instagram publish.' };
        }
        if (this._isBlankValue(imageUrl) || !/^https?:\/\//i.test(String(imageUrl))) {
            return { error: 'Instagram publish requires a public image URL.' };
        }

        const createRes = await this._request('POST', `${igUserId}/media`, {
            image_url: imageUrl,
            caption: message
        });
        if (createRes?.error) return createRes;

        const creationId = createRes?.id;
        if (!creationId) {
            return { error: 'Instagram media creation did not return an id.', details: createRes };
        }

        const publishRes = await this._request('POST', `${igUserId}/media_publish`, {
            creation_id: creationId
        });
        if (publishRes?.error) return publishRes;

        return {
            success: true,
            id: publishRes?.id || creationId,
            creation_id: creationId
        };
    }

    async publishOrganicPostSurfaces({
        pageId,
        message,
        link = '',
        imagePath = null,
        channels = ['facebook']
    }) {
        const requestedChannels = Array.isArray(channels) && channels.length
            ? [...new Set(channels.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))]
            : ['facebook'];

        const results = {};

        if (requestedChannels.includes('facebook')) {
            results.facebook = imagePath
                ? await this.publishPagePhoto(pageId, message, imagePath)
                : await this.publishPagePost(pageId, message, link);
        }

        if (requestedChannels.includes('instagram')) {
            results.instagram = await this.publishInstagramPhoto(message, imagePath);
        }

        const hasRequestedErrors = Object.values(results).some((value) => value?.error);
        if (hasRequestedErrors) {
            return {
                error: 'One or more Meta surfaces failed to publish.',
                details: results
            };
        }

        return {
            success: true,
            id: results.facebook?.id || results.facebook?.post_id || results.instagram?.id || null,
            surfaces: results
        };
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
    async deleteObject(objectId) {
        const targetId = String(objectId || '').trim();
        if (this._isBlankValue(targetId)) {
            return { error: 'Object ID is required to delete a Meta post or asset.' };
        }
        console.log(`[MetaAds] Deleting object ${targetId}...`);
        return await this._request('DELETE', targetId, {});
    }
    async getComments(objectId) {
        console.log(`[MetaAds] Fetching comments for ${objectId}...`);
        const activePageId = await ConfigService.get('META_PAGE_ID');
        const pageToken = await this._getPageToken(activePageId);
        return await this._request('GET', `${objectId}/comments`, {
            access_token: pageToken || await ConfigService.get('META_ACCESS_TOKEN')
        });
    }

    /**
     * Reply to a comment
     */
    async replyToComment(commentId, message) {
        console.log(`[MetaAds] Replying to comment ${commentId}...`);
        const activePageId = await ConfigService.get('META_PAGE_ID');
        const pageToken = await this._getPageToken(activePageId);
        return await this._request('POST', `${commentId}/comments`, {
            message: message,
            access_token: pageToken || await ConfigService.get('META_ACCESS_TOKEN')
        });
    }

    /**
     * Get Page Engagement Insights
     */
    async getPageInsights(pageId) {
        const activePageId = pageId || await ConfigService.get('META_PAGE_ID');
        console.log(`[MetaAds] Fetching insights for Page ${activePageId}...`);
        
        const pageToken = await this._getPageToken(activePageId);
        const endpoint = `${activePageId}/insights`;
        
        return await this._request('GET', endpoint, {
            metric: 'page_impressions_unique,page_post_engagements,page_views_total',
            period: 'day',
            access_token: pageToken || await ConfigService.get('META_ACCESS_TOKEN')
        });
    }

    async getSetupStatus() {
        const accessToken = await ConfigService.get('META_ACCESS_TOKEN');
        const pageId = await ConfigService.get('META_PAGE_ID');
        const adAccountId = await this._getAdAccountId();
        const instagramBusinessAccountId = await this._getInstagramBusinessAccountId();
        return {
            ok: Boolean(accessToken && (pageId || adAccountId)),
            provider: 'meta',
            hasAccessToken: Boolean(accessToken),
            hasPageId: Boolean(pageId),
            hasAdAccountId: Boolean(adAccountId),
            hasInstagramBusinessAccountId: Boolean(instagramBusinessAccountId)
        };
    }
}

module.exports = new MetaAdsTool();

