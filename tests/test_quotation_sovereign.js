const AgencyQuotePlanner = require('../core/agencyQuotePlanner');
const CommercialDocs = require('../core/commercialDocs');

async function testQuotation() {
    console.log("--- Testing Boss's Scenario: 4 ads/week for 4 weeks ---");
    const input = {
        notes: "I need 4 ads per week for 4 weeks with banner creation. Use INR currency.",
        clientName: "MK Fashion",
        clientCompany: "MK Enterprises"
    };

    const plan = AgencyQuotePlanner.buildPlan(input);
    console.log("Campaign Name:", plan.title);
    console.log("Weekly Ads:", plan.summary.weeklyAdsCount);
    console.log("Duration Weeks:", plan.summary.durationWeeks);
    console.log("Total Banners (Auto-Calculated):", plan.summary.bannerCount);
    console.log("Currency:", plan.pricing.currency);
    
    console.log("\n--- Service Items ---");
    plan.pricing.items.forEach(item => {
        console.log(`- ${item.description}: Qty ${item.quantity} | Total: ${item.lineCost}`);
    });

    console.log("\n--- AI Ops Breakdown ---");
    console.log(JSON.stringify(plan.aiOps, null, 2));

    console.log("\n--- Financial Totals ---");
    console.log("Base Cost:", plan.pricing.baseCost);
    console.log("Agency Profit:", plan.pricing.profitAmount);
    console.log("Total Quote:", plan.pricing.total);

    // Verify PDF model mapping
    const model = CommercialDocs.buildQuoteDocumentModel(plan, { clientName: "MK Fashion" });
    console.log("\n--- PDF Model Status ---");
    console.log("Quote Number:", model.quoteNumber);
    console.log("Subtotal:", model.subtotal);
    console.log("Total:", model.total);
}

testQuotation().catch(console.error);
