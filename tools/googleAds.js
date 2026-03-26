const ConfigService = require('../core/config');
const { GoogleAdsApi } = require('google-ads-api');

class GoogleAdsTool {
    constructor() {
        this.client = null;
        this.clientCacheKey = null;
    }

    async init() {
        const client_id = await ConfigService.get('GOOGLE_ADS_CLIENT_ID');
        const client_secret = await ConfigService.get('GOOGLE_ADS_CLIENT_SECRET');
        const developer_token = await ConfigService.get('GOOGLE_ADS_DEVELOPER_TOKEN');

        if (!client_id || !client_secret || !developer_token) {
            throw new Error('Google Ads credentials missing in Firestore (configs/default)');
        }

        const cacheKey = `${client_id}:${developer_token}`;
        if (!this.client || this.clientCacheKey !== cacheKey) {
            this.client = new GoogleAdsApi({
                client_id,
                client_secret,
                developer_token
            });
            this.clientCacheKey = cacheKey;
        }
    }

    _normalizeCustomerId(customerId) {
        return String(customerId || '').replace(/[^\d]/g, '');
    }

    async getCustomer(customerId) {
        await this.init();
        const normalizedCustomerId = this._normalizeCustomerId(customerId);
        const refresh_token = await ConfigService.get('GOOGLE_ADS_REFRESH_TOKEN');
        if (!normalizedCustomerId) throw new Error('GOOGLE_ADS customerId is required');
        if (!refresh_token) throw new Error('GOOGLE_ADS_REFRESH_TOKEN missing in Firestore');

        return this.client.Customer({
            customer_id: normalizedCustomerId,
            refresh_token
        });
    }

    async listCampaigns(customerId) {
        try {
            const customer = await this.getCustomer(customerId);
            const campaigns = await customer.query(`
                SELECT campaign.id, campaign.name, campaign.status
                FROM campaign
                ORDER BY campaign.id DESC
            `);
            return campaigns;
        } catch (error) {
            return { error: 'Google Ads query failed', details: error.message };
        }
    }

    async createCampaignBudget(customerId, name, amountMicros, deliveryMethod = 'STANDARD') {
        try {
            const customer = await this.getCustomer(customerId);
            const result = await customer.campaignBudgets.create([{
                name,
                amount_micros: Number(amountMicros),
                delivery_method: deliveryMethod,
                explicitly_shared: false
            }]);
            return Array.isArray(result) ? result[0] : result;
        } catch (error) {
            return { error: 'Failed to create Google Ads budget', details: error.message };
        }
    }

    async createCampaign(customerId, campaignData) {
        try {
            const customer = await this.getCustomer(customerId);
            const result = await customer.campaigns.create([{
                name: campaignData.name,
                advertising_channel_type: campaignData.advertising_channel_type || 'SEARCH',
                status: campaignData.status || 'PAUSED',
                manual_cpc: {},
                campaign_budget: campaignData.budget_resource_name,
                network_settings: {
                    target_google_search: true,
                    target_search_network: true,
                    target_content_network: false,
                    target_partner_search_network: false
                }
            }]);
            return Array.isArray(result) ? result[0] : result;
        } catch (error) {
            return { error: 'Failed to create Google Ads campaign', details: error.message };
        }
    }

    async createAdGroup(customerId, adGroupData) {
        try {
            const customer = await this.getCustomer(customerId);
            const result = await customer.adGroups.create([{
                name: adGroupData.name,
                campaign: adGroupData.campaign_resource_name,
                status: adGroupData.status || 'ENABLED',
                cpc_bid_micros: Number(adGroupData.cpc_bid_micros || 1000000),
                type: adGroupData.type || 'SEARCH_STANDARD'
            }]);
            return Array.isArray(result) ? result[0] : result;
        } catch (error) {
            return { error: 'Failed to create Google Ads ad group', details: error.message };
        }
    }

    async addKeywords(customerId, adGroupResourceName, keywords = []) {
        try {
            const customer = await this.getCustomer(customerId);
            const operations = keywords
                .filter((keyword) => String(keyword || '').trim())
                .map((keyword) => ({
                    ad_group: adGroupResourceName,
                    status: 'ENABLED',
                    keyword: {
                        text: String(keyword).trim(),
                        match_type: 'PHRASE'
                    }
                }));

            if (!operations.length) {
                return { error: 'No valid keywords supplied' };
            }

            return await customer.adGroupCriteria.create(operations);
        } catch (error) {
            return { error: 'Failed to add Google Ads keywords', details: error.message };
        }
    }

    async createResponsiveSearchAd(customerId, adData) {
        try {
            const customer = await this.getCustomer(customerId);
            const headlines = Array.isArray(adData.headlines) ? adData.headlines : [];
            const descriptions = Array.isArray(adData.descriptions) ? adData.descriptions : [];
            const finalUrls = Array.isArray(adData.final_urls) ? adData.final_urls : [];

            if (!headlines.length || !descriptions.length || !finalUrls.length) {
                return { error: 'Responsive search ad requires headlines, descriptions, and final_urls.' };
            }

            const result = await customer.ads.create([{
                ad_group: adData.ad_group_resource_name,
                status: adData.status || 'PAUSED',
                ad: {
                    final_urls: finalUrls,
                    responsive_search_ad: {
                        headlines: headlines.map((text) => ({ text })),
                        descriptions: descriptions.map((text) => ({ text }))
                    }
                }
            }]);
            return Array.isArray(result) ? result[0] : result;
        } catch (error) {
            return { error: 'Failed to create Google Ads responsive search ad', details: error.message };
        }
    }

    async createImageAsset(customerId, imagePath, assetName) {
        try {
            const customer = await this.getCustomer(customerId);
            const imageBuffer = fs.readFileSync(imagePath);
            const result = await customer.assets.create([{
                name: assetName || `Asset_${Date.now()}`,
                type: 'IMAGE',
                image_asset: {
                    data: imageBuffer.toString('base64')
                }
            }]);
            return Array.isArray(result) ? result[0] : result;
        } catch (error) {
            return { error: 'Failed to create Google Ads image asset', details: error.message };
        }
    }

    async getSetupStatus() {
        const clientId = await ConfigService.get('GOOGLE_ADS_CLIENT_ID');
        const clientSecret = await ConfigService.get('GOOGLE_ADS_CLIENT_SECRET');
        const developerToken = await ConfigService.get('GOOGLE_ADS_DEVELOPER_TOKEN');
        const refreshToken = await ConfigService.get('GOOGLE_ADS_REFRESH_TOKEN');
        return {
            ok: Boolean(clientId && clientSecret && developerToken && refreshToken),
            provider: 'google_ads',
            hasClientId: Boolean(clientId),
            hasClientSecret: Boolean(clientSecret),
            hasDeveloperToken: Boolean(developerToken),
            hasRefreshToken: Boolean(refreshToken)
        };
    }
}

module.exports = new GoogleAdsTool();
