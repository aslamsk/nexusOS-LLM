const ConfigService = require('../core/config');
const axios = require('axios');
const fs = require('fs');

class LinkedInAdsTool {
    constructor() {}

    async publishOrganicPost(urn, text, imagePath = null) {
        const accessToken = await ConfigService.get('LINKEDIN_ACCESS_TOKEN');
        if (!accessToken) return { error: "LINKEDIN_ACCESS_TOKEN missing in Firestore" };
        if (!urn) return { error: "LinkedIn organization URN is required." };
        if (!text || !String(text).trim()) return { error: "LinkedIn post text is required." };

        try {
            let media = [];
            if (imagePath) {
                console.log(`[LinkedIn] Uploading media first: ${imagePath}`);
                const mediaUrn = await this.uploadImage(urn, imagePath);
                if (mediaUrn) {
                    media = [{
                        media: mediaUrn,
                        status: 'READY',
                        title: { text: 'Nexus Creative' }
                    }];
                }
            }

            console.log(`[LinkedIn] Publishing organic post for URN: ${urn}`);
            const response = await axios.post(
                'https://api.linkedin.com/v2/ugcPosts',
                {
                    author: `urn:li:organization:${urn}`,
                    lifecycleState: 'PUBLISHED',
                    specificContent: {
                        'com.linkedin.ugc.ShareContent': {
                            shareCommentary: { text: text },
                            shareMediaCategory: media.length ? 'IMAGE' : 'NONE',
                            media: media
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

    async uploadImage(urn, filePath) {
        const accessToken = await ConfigService.get('LINKEDIN_ACCESS_TOKEN');
        if (!fs.existsSync(filePath)) throw new Error(`Image file not found: ${filePath}`);

        // Step 1: Register Upload
        const registerRes = await axios.post(
            'https://api.linkedin.com/v2/assets?action=registerUpload',
            {
                registerUploadRequest: {
                    recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                    owner: `urn:li:organization:${urn}`,
                    serviceRelationships: [{
                        relationshipType: 'OWNER',
                        identifier: 'urn:li:userGeneratedContent'
                    }]
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Restli-Protocol-Version': '2.0.0'
                }
            }
        );

        const uploadUrl = registerRes.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
        const assetUrn = registerRes.data.value.asset;

        // Step 2: PUT Binary
        const imageBuffer = fs.readFileSync(filePath);
        await axios.put(uploadUrl, imageBuffer, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/octet-stream'
            }
        });

        return assetUrn;
    }

    async deletePost(postId) {
        const accessToken = await ConfigService.get('LINKEDIN_ACCESS_TOKEN');
        if (!accessToken) return { error: "LINKEDIN_ACCESS_TOKEN missing in Firestore" };
        if (!postId) return { error: "LinkedIn post id is required for delete." };

        try {
            await axios.delete(
                `https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(postId)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'X-Restli-Protocol-Version': '2.0.0'
                    }
                }
            );
            return { success: true, deleted: true, id: postId };
        } catch (error) {
            return { error: "LinkedIn delete failed", details: error.response?.data || error.message };
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
