const axios = require('axios');
const ConfigService = require('../core/config');

/**
 * Nexus OS: WhatsApp Tool
 * Uses Meta WhatsApp Cloud API (WhatsApp Business).
 */
class WhatsAppTool {
    /**
     * Send a text message to a phone number.
     */
    async sendMessage(phone, text) {
        console.log(`[WhatsApp] Sending to ${phone}: "${text.substring(0, 50)}..."`);
        const token = await ConfigService.get('META_ACCESS_TOKEN'); // Reuse meta token
        const phoneId = await ConfigService.get('WHATSAPP_PHONE_ID') || await ConfigService.get('META_PAGE_ID'); // Phone ID is usually separate but we can check both

        if (!token || !phoneId) return "Error: WhatsApp credentials (META_ACCESS_TOKEN, WHATSAPP_PHONE_ID) missing.";

        const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;
        
        try {
            const res = await axios.post(url, {
                messaging_product: "whatsapp",
                to: phone,
                type: "text",
                text: { body: text }
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return `SUCCESS: WhatsApp sent to ${phone}. ID: ${res.data.messages?.[0]?.id}`;
        } catch (e) {
            const err = e.response?.data?.error?.message || e.message;
            return `Error sending WhatsApp: ${err}`;
        }
    }

    /**
     * Send an image or video to a phone number.
     */
    async sendMedia(phone, mediaUrl, caption) {
        console.log(`[WhatsApp] Sending media to ${phone}`);
        const token = await ConfigService.get('META_ACCESS_TOKEN');
        const phoneId = await ConfigService.get('WHATSAPP_PHONE_ID');

        if (!token || !phoneId) return "Error: WhatsApp credentials missing.";

        const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

        try {
            const res = await axios.post(url, {
                messaging_product: "whatsapp",
                to: phone,
                type: "image", // Or video, can detect from url
                image: { link: mediaUrl, caption: caption }
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return `SUCCESS: Media WhatsApp sent to ${phone}. ID: ${res.data.messages?.[0]?.id}`;
        } catch (e) {
            const err = e.response?.data?.error?.message || e.message;
            return `Error sending Media WhatsApp: ${err}`;
        }
    }
}

module.exports = new WhatsAppTool();
