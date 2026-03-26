const SERVICE_CATALOG = {
    meta_ads_management: { label: 'Meta Ads Management', unitCost: 5000, unit: 'week' },
    google_ads_management: { label: 'Google Ads Management', unitCost: 6000, unit: 'week' },
    linkedin_ads_management: { label: 'LinkedIn Campaign Setup', unitCost: 5500, unit: 'week' },
    banner_design: { label: 'Banner Design', unitCost: 1500, unit: 'asset' },
    carousel_design: { label: 'Carousel Design', unitCost: 2500, unit: 'asset' },
    video_creative: { label: 'Video Creative', unitCost: 5000, unit: 'asset' },
    marketing_audit: { label: 'Marketing Audit', unitCost: 4000, unit: 'audit' },
    reporting_pack: { label: 'Reporting Pack', unitCost: 2000, unit: 'report' },
    seo_package: { label: 'SEO Package', unitCost: 8000, unit: 'package' },
    landing_page: { label: 'Landing Page', unitCost: 15000, unit: 'project' },
    website_development: { label: 'Website Development', unitCost: 50000, unit: 'project' },
    fullstack_feature: { label: 'Coding / Fullstack Feature', unitCost: 25000, unit: 'feature' },
    ai_automation: { label: 'AI Automation Workflow', unitCost: 20000, unit: 'workflow' },
    copywriting: { label: 'Copywriting', unitCost: 1000, unit: 'deliverable' },
    tag_research: { label: 'Tags / Hashtag Research', unitCost: 800, unit: 'pack' },
    strategy_retainer: { label: 'Strategy Retainer', unitCost: 10000, unit: 'month' }
};

class PricingService {
    getCatalog() {
        return SERVICE_CATALOG;
    }

    buildQuote({ items = [], profitMarginPct = 35, taxPct = 0, currency = 'INR' }) {
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
                lineCost,
                excludeFromProfit: Boolean(item.excludeFromProfit)
            };
        });

        const baseCost = Number(normalizedItems.reduce((sum, item) => sum + item.lineCost, 0).toFixed(2));
        const profitEligibleBaseCost = Number(normalizedItems
            .filter((item) => !item.excludeFromProfit)
            .reduce((sum, item) => sum + item.lineCost, 0)
            .toFixed(2));
        const passthroughCost = Number(normalizedItems
            .filter((item) => item.excludeFromProfit)
            .reduce((sum, item) => sum + item.lineCost, 0)
            .toFixed(2));
        const profitAmount = Number((profitEligibleBaseCost * (Number(profitMarginPct || 0) / 100)).toFixed(2));
        const subtotal = Number((baseCost + profitAmount).toFixed(2));
        const taxAmount = Number((subtotal * (Number(taxPct || 0) / 100)).toFixed(2));
        const total = Number((subtotal + taxAmount).toFixed(2));

        return {
            currency,
            profitMarginPct: Number(profitMarginPct || 0),
            taxPct: Number(taxPct || 0),
            items: normalizedItems,
            baseCost,
            profitEligibleBaseCost,
            passthroughCost,
            profitAmount,
            subtotal,
            taxAmount,
            total
        };
    }
}

module.exports = new PricingService();
