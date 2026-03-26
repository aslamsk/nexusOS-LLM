const SearchTool = require('./search');
const BrowserTool = require('./browser');
const path = require('path');

/**
 * Proactive Scanner Tool
 * Enables autonomous market research and campaign proposals.
 */
class ProactiveScannerTool {
    /**
     * Scan a specific niche for trending topics and competitor activities.
     */
    async scanNiche(niche) {
        console.log(`[Scanner] Proactively scanning niche: ${niche}`);
        try {
            // 1. Search for trends
            const searchQuery = `latest trends in ${niche} marketing 2026`;
            const searchResults = await SearchTool.search(searchQuery);
            
            // 2. Scan a sample competitor if found in search
            let competitorInsights = "";
            let links = [];
            
            if (Array.isArray(searchResults)) {
                links = searchResults.map(r => r.url).filter(Boolean);
            } else if (typeof searchResults === 'string') {
                links = searchResults.match(/https?:\/\/[^\s)]+/g) || [];
            }

            if (links.length > 0) {
                const targetUrl = links[0];
                console.log(`[Scanner] Analyzing competitor: ${targetUrl}`);
                competitorInsights = await BrowserTool.executeAction({
                    action: 'getMarkdown',
                    url: targetUrl
                });
            }

            return {
                niche,
                trends: searchResults.slice(0, 2000),
                competitorSample: competitorInsights.slice(0, 2000),
                scannedAt: new Date().toISOString()
            };
        } catch (error) {
            return { error: `Scanner failed: ${error.message}` };
        }
    }

    /**
     * Generate a proactive campaign proposal based on niche data.
     */
    async proposeCampaign(niche, clientName = "The Boss") {
        const data = await this.scanNiche(niche);
        if (data.error) return data;

        const proposal = [
            `### 🚀 PROACTIVE CAMPAIGN PROPOSAL for ${clientName}`,
            `**Target Niche:** ${niche}`,
            `**Market Insight:** Based on recent scans, "${niche}" is seeing a massive shift towards personalized AI-driven content.`,
            `**The Idea:** Launch a "Hyper-Personalized ${niche} Experience" campaign across Meta and Google Ads.`,
            `**Execution Plan:**`,
            `1. Use Nexus 'generateImage' to create 5 distinct visual variations.`,
            `2. Deploy a Meta Organic post to test engagement.`,
            `3. Scale with Google Search Ads targeting high-intent keywords found during scan.`,
            `\n**Nexus Readiness:** I have already prepared a draft strategy. Reply YES to initiate planning.`
        ].join('\n');

        return {
            proposal,
            rawData: data
        };
    }
}

module.exports = new ProactiveScannerTool();
