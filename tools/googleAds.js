const { GoogleAdsApi } = require('google-ads-api');

class GoogleAdsTool {
    constructor() {
        this.client = null;
        this.customer = null;
    }

    async init() {
        if (!process.env.GOOGLE_ADS_CLIENT_ID || !process.env.GOOGLE_ADS_CLIENT_SECRET || !process.env.GOOGLE_ADS_REFRESH_TOKEN || !process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
            throw new Error("Google Ads credentials missing in environment (.env)");
        }

        if (!this.client) {
            this.client = new GoogleAdsApi({
                client_id: process.env.GOOGLE_ADS_CLIENT_ID,
                client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
                developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
            });
        }
    }

    async getCustomer(customerId) {
        await this.init();
        return this.client.Customer({
            customer_id: customerId,
            refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
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
