const { db } = require('./firebase');
const ConfigService = require('./config');

const DEFAULT_PROVIDER_COSTS = {
    gemini: 0.00035,
    openrouter: 0.00025,
    groq: 0.0002,
    nvidia: 0.0002,
    unknown: 0.0002
};

function normalizeProvider(provider) {
    const value = String(provider || 'unknown').toLowerCase();
    if (value.includes('gemini')) return 'Gemini';
    if (value.includes('openrouter')) return 'OpenRouter';
    if (value.includes('groq')) return 'Groq';
    if (value.includes('nvidia')) return 'NVIDIA';
    return provider || 'Unknown';
}

function providerKey(provider) {
    return String(normalizeProvider(provider)).toLowerCase();
}

function estimateUsageTier(provider, model, quotaMode = 'FREE') {
    const providerName = normalizeProvider(provider);
    const modelName = String(model || '').toLowerCase();
    const normalizedQuota = String(quotaMode || 'FREE').toUpperCase();

    if (providerName === 'OpenRouter' && modelName.includes('free')) return 'free';
    if (normalizedQuota === 'FREE' && ['Gemini', 'Groq', 'NVIDIA'].includes(providerName)) return 'free';
    return 'paid';
}

function estimateCost(provider, usageTier) {
    if (usageTier === 'free') return 0;
    return DEFAULT_PROVIDER_COSTS[providerKey(provider)] || DEFAULT_PROVIDER_COSTS.unknown;
}

function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    return new Date(value);
}

function getStartDateForPeriod(period = 'all') {
    const now = new Date();
    const normalized = String(period || 'all').toLowerCase();
    if (normalized === 'today') {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    if (normalized === '7d') {
        return new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    }
    if (normalized === '30d') {
        return new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    }
    return null;
}

function estimateResetCadence(provider, model, quotaMode = 'FREE') {
    const providerName = normalizeProvider(provider);
    const modelName = String(model || '').toLowerCase();
    const normalizedQuota = String(quotaMode || 'FREE').toUpperCase();

    if (providerName === 'OpenRouter' && modelName.includes('free')) return 'Daily free request window';
    if (providerName === 'Groq' && normalizedQuota === 'FREE') return 'Provider free quota window';
    if (providerName === 'NVIDIA' && normalizedQuota === 'FREE') return 'Provider trial/quota window';
    if (providerName === 'Gemini' && normalizedQuota === 'FREE') return 'Project free quota window';
    if (normalizedQuota !== 'FREE') return 'Paid usage, no free reset';
    return 'Provider-defined reset cadence';
}

class UsageTracker {
    async recordLlmUsage({
        provider,
        model,
        clientId = null,
        sessionId = null,
        runId = null,
        requestPreview = '',
        quotaMode = null
    }) {
        const normalizedProvider = normalizeProvider(provider);
        const normalizedModel = String(model || '').trim() || 'unknown-model';
        const effectiveQuotaMode = quotaMode || await ConfigService.get('QUOTA_MODE') || 'FREE';
        const usageTier = estimateUsageTier(normalizedProvider, normalizedModel, effectiveQuotaMode);
        const estimatedCostUsd = estimateCost(normalizedProvider, usageTier);

        const event = {
            kind: 'llm',
            provider: normalizedProvider,
            model: normalizedModel,
            clientId: clientId || null,
            sessionId: sessionId || null,
            runId: runId || null,
            requestPreview: String(requestPreview || '').slice(0, 160),
            usageTier,
            quotaMode: String(effectiveQuotaMode || 'FREE').toUpperCase(),
            estimatedCostUsd,
            timestamp: new Date()
        };

        return this._persistEvent(event);
    }

    async recordMediaUsage({
        provider,
        model,
        clientId = null,
        sessionId = null,
        runId = null,
        requestPreview = '',
        usageTier = 'paid',
        estimatedCostUsd = 0
    }) {
        const event = {
            kind: 'media',
            provider: normalizeProvider(provider),
            model: String(model || '').trim() || 'unknown-model',
            clientId: clientId || null,
            sessionId: sessionId || null,
            runId: runId || null,
            requestPreview: String(requestPreview || '').slice(0, 160),
            usageTier: usageTier === 'free' ? 'free' : 'paid',
            quotaMode: usageTier === 'free' ? 'FREE' : 'PAID',
            estimatedCostUsd: Number(estimatedCostUsd || 0),
            timestamp: new Date()
        };
        return this._persistEvent(event);
    }

    async _persistEvent(event) {
        if (!db) return event;

        try {
            await db.collection('usage_events').add(event);
        } catch (error) {
            console.error('[UsageTracker] Failed to record usage:', error.message);
        }

        return event;
    }

    _emptySummary(scope = 'global', clientId = null) {
        return {
            scope,
            clientId: clientId || null,
            totals: {
                calls: 0,
                freeCalls: 0,
                paidCalls: 0,
                estimatedCostUsd: 0
            },
            providers: [],
            models: [],
            daily: []
        };
    }

    async getUsageSummary({ clientId = null, period = 'all' } = {}) {
        if (!db) return this._emptySummary(clientId ? 'client' : 'global', clientId);

        try {
            let snapshot;
            if (clientId) {
                snapshot = await db.collection('usage_events').where('clientId', '==', clientId).get();
            } else {
                snapshot = await db.collection('usage_events').get();
            }

            const providerMap = new Map();
            const modelMap = new Map();
            const dailyMap = new Map();
            const summary = this._emptySummary(clientId ? 'client' : 'global', clientId);

            const startDate = getStartDateForPeriod(period);
            snapshot.forEach((doc) => {
                const data = doc.data() || {};
                if (!['llm', 'media'].includes(data.kind)) return;
                const timestampDate = toDate(data.timestamp);
                if (startDate && timestampDate && timestampDate < startDate) return;

                const provider = normalizeProvider(data.provider);
                const model = String(data.model || 'unknown-model');
                const usageTier = data.usageTier === 'free' ? 'free' : 'paid';
                const estimatedCostUsd = Number(data.estimatedCostUsd || 0);
                const timestamp = timestampDate?.toISOString?.() || null;
                const resetCadence = estimateResetCadence(provider, model, data.quotaMode || 'FREE');
                const dayKey = timestampDate ? timestampDate.toISOString().slice(0, 10) : 'unknown';
                const providerEntry = providerMap.get(provider) || {
                    provider,
                    calls: 0,
                    freeCalls: 0,
                    paidCalls: 0,
                    estimatedCostUsd: 0,
                    lastUsedAt: null,
                    kinds: {},
                    resetCadence
                };
                providerEntry.calls += 1;
                providerEntry.freeCalls += usageTier === 'free' ? 1 : 0;
                providerEntry.paidCalls += usageTier === 'paid' ? 1 : 0;
                providerEntry.estimatedCostUsd += estimatedCostUsd;
                providerEntry.kinds[data.kind] = (providerEntry.kinds[data.kind] || 0) + 1;
                providerEntry.lastUsedAt = providerEntry.lastUsedAt && providerEntry.lastUsedAt > timestamp ? providerEntry.lastUsedAt : timestamp;
                providerMap.set(provider, providerEntry);

                const modelKey = `${provider}::${model}`;
                const modelEntry = modelMap.get(modelKey) || {
                    provider,
                    model,
                    calls: 0,
                    freeCalls: 0,
                    paidCalls: 0,
                    estimatedCostUsd: 0,
                    lastUsedAt: null,
                    kind: data.kind,
                    resetCadence
                };
                modelEntry.calls += 1;
                modelEntry.freeCalls += usageTier === 'free' ? 1 : 0;
                modelEntry.paidCalls += usageTier === 'paid' ? 1 : 0;
                modelEntry.estimatedCostUsd += estimatedCostUsd;
                modelEntry.lastUsedAt = modelEntry.lastUsedAt && modelEntry.lastUsedAt > timestamp ? modelEntry.lastUsedAt : timestamp;
                modelMap.set(modelKey, modelEntry);

                summary.totals.calls += 1;
                summary.totals.freeCalls += usageTier === 'free' ? 1 : 0;
                summary.totals.paidCalls += usageTier === 'paid' ? 1 : 0;
                summary.totals.estimatedCostUsd += estimatedCostUsd;

                const dayEntry = dailyMap.get(dayKey) || {
                    date: dayKey,
                    calls: 0,
                    freeCalls: 0,
                    paidCalls: 0,
                    estimatedCostUsd: 0
                };
                dayEntry.calls += 1;
                dayEntry.freeCalls += usageTier === 'free' ? 1 : 0;
                dayEntry.paidCalls += usageTier === 'paid' ? 1 : 0;
                dayEntry.estimatedCostUsd += estimatedCostUsd;
                dailyMap.set(dayKey, dayEntry);
            });

            summary.totals.estimatedCostUsd = Number(summary.totals.estimatedCostUsd.toFixed(6));
            summary.period = period;
            summary.providers = [...providerMap.values()]
                .map((entry) => ({ ...entry, estimatedCostUsd: Number(entry.estimatedCostUsd.toFixed(6)) }))
                .sort((a, b) => b.calls - a.calls);
            summary.models = [...modelMap.values()]
                .map((entry) => ({ ...entry, estimatedCostUsd: Number(entry.estimatedCostUsd.toFixed(6)) }))
                .sort((a, b) => b.calls - a.calls);
            summary.daily = [...dailyMap.values()]
                .map((entry) => ({ ...entry, estimatedCostUsd: Number(entry.estimatedCostUsd.toFixed(6)) }))
                .sort((a, b) => a.date.localeCompare(b.date));
            return summary;
        } catch (error) {
            console.error('[UsageTracker] Failed to summarize usage:', error.message);
            return this._emptySummary(clientId ? 'client' : 'global', clientId);
        }
    }

    async getClientLeaderboard({ period = 'all', limit = 8 } = {}) {
        if (!db) return [];

        try {
            const [usageSnapshot, clientsSnapshot] = await Promise.all([
                db.collection('usage_events').get(),
                db.collection('clients').get()
            ]);

            const startDate = getStartDateForPeriod(period);
            const clientNames = new Map();
            clientsSnapshot.forEach((doc) => {
                const data = doc.data() || {};
                clientNames.set(doc.id, data.name || data.company || doc.id);
            });

            const totals = new Map();
            usageSnapshot.forEach((doc) => {
                const data = doc.data() || {};
                if (!data.clientId || !['llm', 'media'].includes(data.kind)) return;
                const timestampDate = toDate(data.timestamp);
                if (startDate && timestampDate && timestampDate < startDate) return;

                const key = data.clientId;
                const entry = totals.get(key) || {
                    clientId: key,
                    clientName: clientNames.get(key) || key,
                    calls: 0,
                    freeCalls: 0,
                    paidCalls: 0,
                    estimatedCostUsd: 0
                };
                entry.calls += 1;
                entry.freeCalls += data.usageTier === 'free' ? 1 : 0;
                entry.paidCalls += data.usageTier === 'paid' ? 1 : 0;
                entry.estimatedCostUsd += Number(data.estimatedCostUsd || 0);
                totals.set(key, entry);
            });

            return [...totals.values()]
                .map((entry) => ({ ...entry, estimatedCostUsd: Number(entry.estimatedCostUsd.toFixed(6)) }))
                .sort((a, b) => b.calls - a.calls)
                .slice(0, limit);
        } catch (error) {
            console.error('[UsageTracker] Failed to build client leaderboard:', error.message);
            return [];
        }
    }
}

module.exports = new UsageTracker();
