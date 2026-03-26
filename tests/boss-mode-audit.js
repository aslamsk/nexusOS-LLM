const ConfigService = require('../core/config');
const { db } = require('../core/firebase');
const SearchTool = require('../tools/search');
const MarketingUtils = require('../tools/marketingUtils');
const ImageGenTool = require('../tools/imageGen');
const VideoGenTool = require('../tools/videoGen');
const AgencyQuotePlanner = require('../core/agencyQuotePlanner');
const MetaAdsTool = require('../tools/metaAds');
const EmailTool = require('../tools/email');

async function audit() {
    console.log("=== NEXUS OS: BOSS MODE SYSTEM AUDIT ===");
    
    // 1. Mock Client Onboarding
    const testClientId = "test_boss_agency_" + Date.now();
    console.log(`[Phase 1] Provisioning Test Client: ${testClientId}`);
    
    const mockKeys = {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || "AIzaSy...",
        TAVILY_API_KEY: process.env.TAVILY_API_KEY || "tvly-...",
        META_ACCESS_TOKEN: "MOCK_TOKEN",
        META_PAGE_ID: "123456789"
    };
    
    // Set overrides to simulate this client session
    ConfigService.setClientOverrides(mockKeys);
    console.log("PASS: Client Overrides injected into ConfigService.");

    const results = [];

    // 2. Research Test
    try {
        console.log("[Phase 2] Testing Research (searchWeb)...");
        // We might not have a real Tavily key, so we check if the tool is instantiated
        const searchRes = await SearchTool.search("NexusOS AI agency benefits");
        results.push({ tool: 'searchWeb', ok: !!searchRes });
    } catch (e) {
        results.push({ tool: 'searchWeb', ok: false, error: e.message });
    }

    // 3. Marketing Intelligence Test
    try {
        console.log("[Phase 3] Testing Intelligence (analyzeMarketingPage)...");
        const analysis = MarketingUtils.analyzeMarketingPage({ target: "https://nexusos.ai" });
        results.push({ tool: 'analyzeMarketingPage', ok: analysis.ok });
    } catch (e) {
        results.push({ tool: 'analyzeMarketingPage', ok: false, error: e.message });
    }

    // 4. Creative Test (ImageGen)
    try {
        console.log("[Phase 4] Testing Creative (generateImage)...");
        // We verify the model name and static setup
        const imgGen = new ImageGenTool();
        results.push({ tool: 'generateImage', ok: imgGen.modelName === 'imagen-3.0-generate-001' });
    } catch (e) {
        results.push({ tool: 'generateImage', ok: false, error: e.message });
    }

    // 5. Financial Test (Planner)
    try {
        console.log("[Phase 5] Testing Financial (buildAgencyQuotePlan)...");
        const plan = AgencyQuotePlanner.buildPackage({ campaignName: "Test Campaign" });
        results.push({ tool: 'buildAgencyQuotePlan', ok: !!plan.totalPrice });
    } catch (e) {
        results.push({ tool: 'buildAgencyQuotePlan', ok: false, error: e.message });
    }

    // 6. Execution Test (Meta Ads Status)
    try {
        console.log("[Phase 6] Testing Execution (metaAds Setup Status)...");
        const status = await MetaAdsTool.getSetupStatus();
        results.push({ tool: 'metaAdsStatus', ok: status.hasAccessToken === true });
    } catch (e) {
        results.push({ tool: 'metaAdsStatus', ok: false, error: e.message });
    }

    console.log("\n=== AUDIT RESULTS ===");
    console.table(results);
    
    // Clear overrides
    ConfigService.setClientOverrides({});
    console.log("Audit Complete.");
}

audit().catch(console.error);
