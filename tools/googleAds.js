const ConfigService = require('../core/config');
const { GoogleAdsApi } = require('google-ads-api');

class GoogleAdsTool {
    constructor() {
        this.client = null;
    }

    async init() {
        const client_id = await ConfigService.get('GOOGLE_ADS_CLIENT_ID');
        const client_secret = await ConfigService.get('GOOGLE_ADS_CLIENT_SECRET');
        const developer_token = await ConfigService.get('GOOGLE_ADS_DEVELOPER_TOKEN');

        if (!client_id || !client_secret || !developer_token) {
            throw new Error("Google Ads credentials missing in Firestore (configs/default)");
        }

        if (!this.client) {
            this.client = new GoogleAdsApi({
                client_id,
                client_secret,
                developer_token,
            });
        }
    }

    async getCustomer(customerId) {
        await this.init();
        const refresh_token = await ConfigService.get('GOOGLE_ADS_REFRESH_TOKEN');
        if (!refresh_token) throw new Error("GOOGLE_ADS_REFRESH_TOKEN missing in Firestore");
        
        return this.client.Customer({
            customer_id: customerId,
            refresh_token: refresh_token,
        });
    }

    async listCampaigns(customerId) {
        try {
            const customer = await this.getCustomer(customerId);
            const campaigns = await customer.query(`
                SELECT campaign.id, campaign.name, campaign.status 
                FROM campaign 
                WHERE campaign.status = 'ENABLED'
            `);
            return campaigns;
        } catch (error) {
            return { error: "Google Ads query failed", details: error.message };
        }
    }

    async createCampaign(customerId, campaignData) {
        try {
            const customer = await this.getCustomer(customerId);
            const result = await customer.campaigns.create([
                {
                    name: campaignData.name,
                    advertising_channel_type: 'SEARCH',
                    status: 'PAUSED',
                    manual_cpc: {},
                    campaign_budget: campaignData.budget_resource_name,
                    network_settings: {
                        target_google_search: true,
                        target_search_network: true,
                    },
                }
            ]);
            return result;
        } catch (error) {
            return { error: "Failed to create Google Ads campaign", details: error.message };
        }
    }
}

module.exports = new GoogleAdsTool();
