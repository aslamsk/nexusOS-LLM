const ConfigService = require('../core/config');
const axios = require('axios');

class LinkedInAdsTool {
    constructor() {}

    async publishOrganicPost(urn, text) {
        const accessToken = await ConfigService.get('LINKEDIN_ACCESS_TOKEN');
        if (!accessToken) {
            return { error: "LINKEDIN_ACCESS_TOKEN missing in Firestore" };
        }
        if (!urn) {
            return { error: "LinkedIn organization URN is required." };
        }
        if (!text || !String(text).trim()) {
            return { error: "LinkedIn post text is required." };
        }

        console.log(`[LinkedIn] Publishing organic post for URN: ${urn}`);
        try {
            const response = await axios.post(
                'https://api.linkedin.com/v2/ugcPosts',
                {
                    author: `urn:li:organization:${urn}`,
                    lifecycleState: 'PUBLISHED',
                    specificContent: {
                        'com.linkedin.ugc.ShareContent': {
                            shareCommentary: { text: text },
                            shareMediaCategory: 'NONE'
                        }
                    },
                    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'X-Restli-Protocol-Version': '2.0.0',
                        'Content-Type': 'application/json'
                    }
                }
            );
            return { success: true, id: response.headers['x-restli-id'] };
        } catch (error) {
            return { error: "LinkedIn post failed", details: error.response?.data || error.message };
        }
    }

    async getMemberInfo() {
        const accessToken = await ConfigService.get('LINKEDIN_ACCESS_TOKEN');
        if (!accessToken) return { error: "Missing token" };
        try {
            const response = await axios.get('https://api.linkedin.com/v2/me', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            return response.data;
        } catch (error) {
            return { error: "Failed to fetch LinkedIn info", details: error.message };
        }
    }

    async getSetupStatus() {
        const accessToken = await ConfigService.get('LINKEDIN_ACCESS_TOKEN');
        return {
            ok: Boolean(accessToken),
            provider: 'linkedin',
            hasAccessToken: Boolean(accessToken)
        };
    }
}

module.exports = new LinkedInAdsTool();
