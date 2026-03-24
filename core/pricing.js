const SERVICE_CATALOG = {
    meta_ads_management: { label: 'Meta Ads Management', unitCost: 120, unit: 'campaign' },
    google_ads_management: { label: 'Google Ads Management', unitCost: 140, unit: 'campaign' },
    linkedin_ads_management: { label: 'LinkedIn Campaign Setup', unitCost: 130, unit: 'campaign' },
    banner_design: { label: 'Banner Design', unitCost: 25, unit: 'asset' },
    video_creative: { label: 'Video Creative', unitCost: 95, unit: 'asset' },
    landing_page: { label: 'Landing Page', unitCost: 220, unit: 'project' },
    fullstack_feature: { label: 'Coding / Fullstack Feature', unitCost: 320, unit: 'feature' },
    ai_automation: { label: 'AI Automation Workflow', unitCost: 260, unit: 'workflow' },
    copywriting: { label: 'Copywriting', unitCost: 35, unit: 'deliverable' },
    strategy_retainer: { label: 'Strategy Retainer', unitCost: 180, unit: 'month' }
};

class PricingService {
    getCatalog() {
        return SERVICE_CATALOG;
    }

    buildQuote({ items = [], profitMarginPct = 35, taxPct = 0, currency = 'USD' }) {
        const normalizedItems = items.map((item) => {
            const catalogItem = SERVICE_CATALOG[item.serviceCode] || {
                label: item.description || item.serviceCode || 'Custom Service',
                unitCost: Number(item.unitCost || 0),
                unit: item.unit || 'unit'
            };
            const quantity = Number(item.quantity || 1);
            const unitCost = Number(item.unitCost ?? catalogItem.unitCost ?? 0);
            const lineCost = Number((quantity * unitCost).toFixed(2));
            return {
                serviceCode: item.serviceCode || 'custom',
                description: item.description || catalogItem.label,
                unit: item.unit || catalogItem.unit,
                quantity,
                unitCost,
                lineCost
            };
        });

        const baseCost = Number(normalizedItems.reduce((sum, item) => sum + item.lineCost, 0).toFixed(2));
        const profitAmount = Number((baseCost * (Number(profitMarginPct || 0) / 100)).toFixed(2));
        const subtotal = Number((baseCost + profitAmount).toFixed(2));
        const taxAmount = Number((subtotal * (Number(taxPct || 0) / 100)).toFixed(2));
        const total = Number((subtotal + taxAmount).toFixed(2));

        return {
            currency,
            profitMarginPct: Number(profitMarginPct || 0),
            taxPct: Number(taxPct || 0),
            items: normalizedItems,
            baseCost,
            profitAmount,
            subtotal,
            taxAmount,
            total
        };
    }
}

module.exports = new PricingService();
