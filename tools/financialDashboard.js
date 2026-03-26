/**
 * Financial Dashboard Tool
 * Tracks agency spend, revenue, and profit across all channels.
 * Generates live P&L reports for the Boss.
 */

const fs = require('fs');
const path = require('path');

const LEDGER_PATH = path.join(__dirname, '..', 'data', 'agency_ledger.json');

function ensureDataDir() {
    const dir = path.dirname(LEDGER_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadLedger() {
    ensureDataDir();
    if (!fs.existsSync(LEDGER_PATH)) return { entries: [], summary: { totalRevenue: 0, totalCost: 0, totalProfit: 0 } };
    try {
        return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    } catch {
        return { entries: [], summary: { totalRevenue: 0, totalCost: 0, totalProfit: 0 } };
    }
}

function saveLedger(ledger) {
    ensureDataDir();
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2), 'utf8');
}

class FinancialDashboard {
    /**
     * Record a spend event (API usage, ad spend, etc.)
     */
    trackSpend({ provider, amount, currency = 'USD', category = 'api', jobId = '', clientId = '', description = '' }) {
        const ledger = loadLedger();
        const entry = {
            id: `TXN-${Date.now().toString(36).toUpperCase()}`,
            type: 'expense',
            provider,
            amount: Number(amount) || 0,
            currency,
            category,
            jobId,
            clientId,
            description,
            timestamp: new Date().toISOString()
        };
        ledger.entries.push(entry);
        ledger.summary.totalCost = Number((ledger.summary.totalCost + entry.amount).toFixed(4));
        ledger.summary.totalProfit = Number((ledger.summary.totalRevenue - ledger.summary.totalCost).toFixed(4));
        saveLedger(ledger);
        return { ok: true, entry, summary: ledger.summary };
    }

    /**
     * Record revenue (client payment, quote acceptance, etc.)
     */
    trackRevenue({ amount, currency = 'USD', clientId = '', quoteId = '', description = '' }) {
        const ledger = loadLedger();
        const entry = {
            id: `TXN-${Date.now().toString(36).toUpperCase()}`,
            type: 'revenue',
            amount: Number(amount) || 0,
            currency,
            clientId,
            quoteId,
            description,
            timestamp: new Date().toISOString()
        };
        ledger.entries.push(entry);
        ledger.summary.totalRevenue = Number((ledger.summary.totalRevenue + entry.amount).toFixed(4));
        ledger.summary.totalProfit = Number((ledger.summary.totalRevenue - ledger.summary.totalCost).toFixed(4));
        saveLedger(ledger);
        return { ok: true, entry, summary: ledger.summary };
    }

    /**
     * Generate a P&L report
     */
    generatePnlReport({ period = 'all', clientId = '' } = {}) {
        const ledger = loadLedger();
        let entries = ledger.entries;

        // Filter by period
        if (period !== 'all') {
            const now = new Date();
            const cutoff = new Date();
            if (period === 'today') cutoff.setHours(0, 0, 0, 0);
            else if (period === 'week') cutoff.setDate(now.getDate() - 7);
            else if (period === 'month') cutoff.setMonth(now.getMonth() - 1);
            entries = entries.filter(e => new Date(e.timestamp) >= cutoff);
        }

        // Filter by client
        if (clientId) entries = entries.filter(e => e.clientId === clientId);

        const revenue = entries.filter(e => e.type === 'revenue').reduce((s, e) => s + e.amount, 0);
        const expenses = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

        // Group expenses by provider
        const byProvider = {};
        entries.filter(e => e.type === 'expense').forEach(e => {
            if (!byProvider[e.provider]) byProvider[e.provider] = 0;
            byProvider[e.provider] = Number((byProvider[e.provider] + e.amount).toFixed(4));
        });

        // Group expenses by category
        const byCategory = {};
        entries.filter(e => e.type === 'expense').forEach(e => {
            if (!byCategory[e.category]) byCategory[e.category] = 0;
            byCategory[e.category] = Number((byCategory[e.category] + e.amount).toFixed(4));
        });

        return {
            period,
            clientId: clientId || 'all',
            totalRevenue: Number(revenue.toFixed(2)),
            totalExpenses: Number(expenses.toFixed(2)),
            netProfit: Number((revenue - expenses).toFixed(2)),
            profitMargin: revenue > 0 ? Number(((revenue - expenses) / revenue * 100).toFixed(1)) : 0,
            expensesByProvider: byProvider,
            expensesByCategory: byCategory,
            transactionCount: entries.length,
            recentTransactions: entries.slice(-10).reverse()
        };
    }

    /**
     * Get the full ledger summary
     */
    getSummary() {
        const ledger = loadLedger();
        return ledger.summary;
    }

    /**
     * Reset ledger (for testing / new fiscal period)
     */
    resetLedger() {
        saveLedger({ entries: [], summary: { totalRevenue: 0, totalCost: 0, totalProfit: 0 } });
        return { ok: true, message: 'Ledger reset complete.' };
    }
}

module.exports = new FinancialDashboard();
