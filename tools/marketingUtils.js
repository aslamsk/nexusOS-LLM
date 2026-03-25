const { URL } = require('url');

function normalizeList(input) {
    if (Array.isArray(input)) return input.map((item) => String(item).trim()).filter(Boolean);
    return String(input || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function parseTarget(target) {
    const value = String(target || '').trim();
    if (!value) return { raw: '', hostname: '', pathname: '', isUrl: false };
    try {
        const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
        const parsed = new URL(withProtocol);
        return {
            raw: value,
            hostname: parsed.hostname,
            pathname: parsed.pathname,
            isUrl: true
        };
    } catch (_) {
        return { raw: value, hostname: '', pathname: '', isUrl: false };
    }
}

function score(label, seed) {
    const base = Math.max(4, Math.min(9, seed));
    return { label, score: base };
}

class MarketingUtilsTool {
    analyzePage({ target, notes = '', channels = [] }) {
        const parsed = parseTarget(target);
        const normalizedChannels = normalizeList(channels);
        const text = `${target} ${notes}`.toLowerCase();
        const signals = {
            hasPricingIntent: /(price|pricing|quote|cost|plan)/.test(text),
            hasLeadIntent: /(lead|demo|call|book|contact)/.test(text),
            hasEcomIntent: /(shop|buy|cart|product|checkout)/.test(text),
            hasB2BIntent: /(saas|agency|service|b2b|enterprise)/.test(text)
        };

        const findings = [
            score('Message clarity', signals.hasB2BIntent ? 7 : 6),
            score('Conversion readiness', signals.hasLeadIntent || signals.hasEcomIntent ? 7 : 5),
            score('Trust signals', notes ? 6 : 5),
            score('SEO readiness', parsed.isUrl ? 6 : 5)
        ];

        const quickWins = [
            'Tighten the hero section so the offer, audience, and outcome are visible in the first screen.',
            'Add one primary CTA path and reduce competing actions around it.',
            'Strengthen trust with proof blocks: testimonials, logos, case studies, guarantees.',
            'Map each major section to one search or purchase intent.'
        ];

        return {
            ok: true,
            type: 'page_analysis',
            target: parsed.raw || target,
            page: parsed,
            channels: normalizedChannels,
            signals,
            findings,
            quickWins,
            summary: parsed.isUrl
                ? `Page analysis prepared for ${parsed.hostname}.`
                : 'Page analysis prepared from the provided target/topic.'
        };
    }

    scanCompetitors({ target, competitors = [], notes = '' }) {
        const parsed = parseTarget(target);
        const normalizedCompetitors = normalizeList(competitors);
        const rows = normalizedCompetitors.map((name, index) => ({
            competitor: name,
            position: index + 1,
            likelyStrength: index % 2 === 0 ? 'Clearer offer framing' : 'Stronger trust and proof presentation',
            likelyGap: index % 2 === 0 ? 'May be weak on differentiation depth' : 'May be weak on urgency and conversion flow',
            opportunity: `Create a sharper angle around ${parsed.hostname || 'your offer'} with more specific business outcomes.`
        }));

        return {
            ok: true,
            type: 'competitor_scan',
            target: parsed.raw || target,
            competitorCount: rows.length,
            notes,
            rows,
            summary: rows.length
                ? `Competitor scan created for ${rows.length} competitors.`
                : 'No competitors supplied. Provide competitor names or domains for a richer scan.'
        };
    }

    generateSocialCalendar({ target, channels = [], weeks = 4, theme = '', notes = '' }) {
        const normalizedChannels = normalizeList(channels);
        const totalWeeks = Math.max(1, Number(weeks || 4));
        const posts = [];
        for (let week = 1; week <= totalWeeks; week += 1) {
            posts.push({
                week,
                pillar: week % 2 === 0 ? 'Trust + proof' : 'Problem + solution',
                hook: `Week ${week}: ${theme || target || 'Campaign focus'} angle`,
                format: week % 3 === 0 ? 'Carousel' : week % 2 === 0 ? 'Short video' : 'Static post',
                cta: week % 2 === 0 ? 'Book a call' : 'Learn more',
                channels: normalizedChannels.length ? normalizedChannels : ['Instagram', 'LinkedIn']
            });
        }

        return {
            ok: true,
            type: 'social_calendar',
            target,
            theme,
            notes,
            weeks: totalWeeks,
            posts,
            summary: `Generated a ${totalWeeks}-week social calendar.`
        };
    }
}

module.exports = new MarketingUtilsTool();
