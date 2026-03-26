const PricingService = require('./pricing');

const MODEL_COSTS = {
    gemini_2_5_flash: {
        label: 'Gemini 2.5 Flash',
        inputPerMillion: 0.30,
        outputPerMillion: 2.50
    },
    imagen_4: {
        label: 'Imagen 4',
        perImage: 0.04
    },
    veo_3_1: {
        label: 'Veo 3.1',
        perVideo: 0.02
    }
};

function round(value) {
    return Number(Number(value || 0).toFixed(2));
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function estimateAiOpsCost(scope) {
    const totalAds = (scope.weeklyAdsCount || 0) * (scope.durationWeeks || 0);
    const contentUnits =
        scope.bannerCount +
        scope.carouselCount +
        scope.videoCount +
        scope.contentDeliverables +
        scope.tagPackages +
        scope.reportCount +
        scope.auditCount +
        totalAds +
        (scope.websiteProject ? 6 : 0) +
        (scope.websitePages * 2);

    const llmCallCount = 10 + (contentUnits * 4) + ((scope.metaAdsWeeks + scope.googleAdsWeeks + scope.linkedinAdsWeeks) * 3);
    const imageRenders = Math.max(0, (scope.bannerCount * 4) + (scope.carouselCount * 5) + (totalAds * 2));
    const videoRenders = Math.max(0, scope.videoCount);

    const llmCostPerCall =
        ((7000 / 1000000) * MODEL_COSTS.gemini_2_5_flash.inputPerMillion) +
        ((1800 / 1000000) * MODEL_COSTS.gemini_2_5_flash.outputPerMillion);

    const llmCost = llmCallCount * llmCostPerCall;
    const imageCost = imageRenders * MODEL_COSTS.imagen_4.perImage;
    const videoCost = videoRenders * MODEL_COSTS.veo_3_1.perVideo;

    return {
        llmProvider: MODEL_COSTS.gemini_2_5_flash.label,
        imageProvider: MODEL_COSTS.imagen_4.label,
        videoProvider: MODEL_COSTS.veo_3_1.label,
        llmCallCount,
        imageRenders,
        videoRenders,
        totalAds,
        llmCost: round(llmCost),
        imageCost: round(imageCost),
        videoCost: round(videoCost),
        totalCost: round(llmCost + imageCost + videoCost)
    };
}

function buildServiceItems(scope, aiOps, platformFee) {
    const items = [];
    const pushService = (condition, serviceCode, quantity, description, extras = {}) => {
        if (!condition || quantity <= 0) return;
        items.push({
            serviceCode,
            quantity,
            description,
            ...extras
        });
    };

    pushService(scope.bannerCount > 0, 'banner_design', scope.bannerCount, `${scope.bannerCount} banner creative${scope.bannerCount === 1 ? '' : 's'}`);
    pushService(scope.carouselCount > 0, 'carousel_design', scope.carouselCount, `${scope.carouselCount} carousel creative${scope.carouselCount === 1 ? '' : 's'}`);
    pushService(scope.videoCount > 0, 'video_creative', scope.videoCount, `${scope.videoCount} video creative${scope.videoCount === 1 ? '' : 's'}`);
    pushService(scope.contentDeliverables > 0, 'copywriting', scope.contentDeliverables, `${scope.contentDeliverables} content/caption deliverable${scope.contentDeliverables === 1 ? '' : 's'}`);
    pushService(scope.tagPackages > 0, 'tag_research', scope.tagPackages, `${scope.tagPackages} tag / keyword / hashtag research pack${scope.tagPackages === 1 ? '' : 's'}`);
    pushService(scope.reportCount > 0, 'reporting_pack', scope.reportCount, `${scope.reportCount} reporting pack${scope.reportCount === 1 ? '' : 's'}`);
    pushService(scope.auditCount > 0, 'marketing_audit', scope.auditCount, `${scope.auditCount} audit engagement${scope.auditCount === 1 ? '' : 's'}`);
    pushService(scope.metaAdsWeeks > 0, 'meta_ads_management', scope.metaAdsWeeks, `Meta ads management for ${scope.metaAdsWeeks} week${scope.metaAdsWeeks === 1 ? '' : 's'}`);
    pushService(scope.googleAdsWeeks > 0, 'google_ads_management', scope.googleAdsWeeks, `Google ads management for ${scope.googleAdsWeeks} week${scope.googleAdsWeeks === 1 ? '' : 's'}`);
    pushService(scope.linkedinAdsWeeks > 0, 'linkedin_ads_management', scope.linkedinAdsWeeks, `LinkedIn ads management for ${scope.linkedinAdsWeeks} week${scope.linkedinAdsWeeks === 1 ? '' : 's'}`);
    pushService(scope.websiteProject, 'website_development', 1, `Website development (${scope.websitePages} page scope)`);
    pushService(scope.websiteProject && scope.websitePages > 1, 'fullstack_feature', Math.max(0, scope.websitePages - 1), `Additional website page / feature implementation`);
    pushService(scope.includeStrategyRetainer, 'strategy_retainer', 1, 'Strategy, optimization, and client review retainer');

    if (aiOps.totalCost > 0) {
        items.push({
            serviceCode: 'custom',
            quantity: 1,
            unit: 'package',
            unitCost: aiOps.totalCost,
            description: `AI Ops / API Data Usage (${aiOps.llmProvider}${aiOps.imageRenders ? ` + ${aiOps.imageProvider}` : ''} - ${aiOps.imageRenders} renders)`,
            excludeFromProfit: true
        });
    }

    if (platformFee > 0) {
        items.push({
            serviceCode: 'custom',
            quantity: 1,
            unit: 'package',
            unitCost: platformFee,
            description: 'Nexus OS platform orchestration and delivery fee'
        });
    }

    if (scope.adSpendMonthly > 0) {
        items.push({
            serviceCode: 'custom',
            quantity: 1,
            unit: 'month',
            unitCost: scope.adSpendMonthly,
            description: 'Ad spend passthrough budget',
            excludeFromProfit: true
        });
    }

    return items;
}

function computePlatformFee(scope) {
    const complexityUnits =
        scope.bannerCount +
        scope.carouselCount +
        scope.videoCount +
        scope.contentDeliverables +
        scope.tagPackages +
        scope.reportCount +
        scope.auditCount +
        scope.metaAdsWeeks +
        scope.googleAdsWeeks +
        scope.linkedinAdsWeeks +
        (scope.websiteProject ? 5 : 0);
    return round(Math.max(12, complexityUnits * 4.5));
}

function normalizeScope(input = {}) {
    const searchValues = String(input.notes || input.campaignName || '').toLowerCase();
    
    // Detect "X ads per week for Y weeks"
    let weeklyAdsCount = toNumber(input.weeklyAdsCount, 0);
    let durationWeeks = toNumber(input.durationWeeks, 0);
    
    if (weeklyAdsCount === 0 || durationWeeks === 0) {
        const adsMatch = searchValues.match(/(\d+)\s*ads?\s*\/\s*week/i) || searchValues.match(/(\d+)\s*ads?\s*per\s*week/i);
        const weeksMatch = searchValues.match(/(\d+)\s*weeks?/i);
        if (adsMatch) weeklyAdsCount = parseInt(adsMatch[1]);
        if (weeksMatch) durationWeeks = parseInt(weeksMatch[1]);
    }

    const totalAds = weeklyAdsCount * durationWeeks;
    
    return {
        campaignName: input.campaignName || (weeklyAdsCount ? `${weeklyAdsCount} Ads/Week Marketing Package` : 'Agency growth package'),
        weeklyAdsCount: Math.max(0, weeklyAdsCount),
        durationWeeks: Math.max(0, durationWeeks),
        bannerCount: Math.max(toNumber(input.bannerCount, 0), totalAds),
        carouselCount: Math.max(0, toNumber(input.carouselCount, 0)),
        videoCount: Math.max(0, toNumber(input.videoCount, 0)),
        contentDeliverables: Math.max(0, toNumber(input.contentDeliverables, 0)),
        tagPackages: Math.max(0, toNumber(input.tagPackages, 0)),
        reportCount: Math.max(0, toNumber(input.reportCount, 0)),
        auditCount: Math.max(0, toNumber(input.auditCount, 0)),
        metaAdsWeeks: Math.max(0, toNumber(input.metaAdsWeeks ?? input.weeks ?? durationWeeks, 0)),
        googleAdsWeeks: Math.max(0, toNumber(input.googleAdsWeeks, 0)),
        linkedinAdsWeeks: Math.max(0, toNumber(input.linkedinAdsWeeks, 0)),
        websiteProject: Boolean(input.websiteProject || /website/i.test(String(input.notes || ''))),
        websitePages: Math.max(1, toNumber(input.websitePages, 1)),
        adSpendMonthly: Math.max(0, toNumber(input.adSpendMonthly, 0)),
        profitMarginPct: Math.max(0, toNumber(input.profitMarginPct, 35)),
        taxPct: Math.max(0, toNumber(input.taxPct, 0)),
        currency: input.currency || 'INR',
        includeStrategyRetainer: input.includeStrategyRetainer !== undefined ? Boolean(input.includeStrategyRetainer) : true,
        notes: input.notes || ''
    };
}

class AgencyQuotePlanner {
    buildPlan(input = {}) {
        const scope = normalizeScope(input);
        const aiOps = estimateAiOpsCost(scope);
        const platformFee = computePlatformFee(scope);
        const items = buildServiceItems(scope, aiOps, platformFee);
        const pricing = PricingService.buildQuote({
            items,
            profitMarginPct: scope.profitMarginPct,
            taxPct: scope.taxPct,
            currency: scope.currency
        });

        return {
            title: scope.campaignName,
            summary: {
                ...scope,
                activeChannels: [
                    scope.metaAdsWeeks > 0 ? 'Meta Ads' : null,
                    scope.googleAdsWeeks > 0 ? 'Google Ads' : null,
                    scope.linkedinAdsWeeks > 0 ? 'LinkedIn Ads' : null
                ].filter(Boolean)
            },
            aiOps,
            platformFee,
            assumptions: [
                'Ad spend passthrough is excluded from profit markup by default.',
                'AI/model estimate assumes paid usage after free-tier windows are exhausted.',
                'Creative counts are treated literally: one banner means one banner, unless more creative variants are requested.',
                'Nexus OS platform fee covers orchestration, workflow packaging, and commercial document delivery.'
            ],
            pricing
        };
    }
}

module.exports = new AgencyQuotePlanner();
