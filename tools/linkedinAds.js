const axios = require('axios');

class LinkedInAdsTool {
    constructor() {
        this.accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
    }

    async publishOrganicPost(urn, text) {
        if (!this.accessToken) {
            return { error: "LINKEDIN_ACCESS_TOKEN missing in environment (.env)" };
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
                        'Authorization': `Bearer ${this.accessToken}`,
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
        if (!this.accessToken) return { error: "Missing token" };
        try {
            const response = await axios.get('https://api.linkedin.com/v2/me', {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            return response.data;
        } catch (error) {
            return { error: "Failed to fetch LinkedIn info", details: error.message };
        }
    }
}

module.exports = new LinkedInAdsTool();
