const { db } = require('./firebase');
require('dotenv').config();

/**
 * Global Configuration Service
 * Manages API keys and settings from Firestore with environment fallbacks.
 */
class ConfigService {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 30 * 1000; // 30 seconds cache (for faster sync)
        this.lastFetch = 0;
        this.defaultCompanyId = 'default';
        this.clientOverrides = {}; // Dynamic multi-tenant isolated keys
    }

    /**
     * Set dynamic overrides for the current execution context (Client specific keys)
     */
    setClientOverrides(configs) {
        this.clientOverrides = configs || {};
    }

    /**
     * Get a configuration value by key.
     * @param {string} key Configuration key (e.g., 'GEMINI_API_KEY')
     * @param {string} companyId Optional company identifier
     * @returns {Promise<string|null>}
     */
    async get(key, companyId = this.defaultCompanyId) {
        // 0. Check dynamic client overrides first to ensure true isolation
        if (this.clientOverrides[key]) {
            return this.clientOverrides[key];
        }

        // 1. Ensure cache is populated for the requested company
        await this._ensureCache(companyId);
        const companyConfigs = this.cache.get(companyId);
        if (companyConfigs && companyConfigs[key]) {
            return companyConfigs[key];
        }

        // 2. Hierarchical Fallback: Check 'default' (Global Admin) if not already checked
        if (companyId !== this.defaultCompanyId) {
            await this._ensureCache(this.defaultCompanyId);
            const defaultConfigs = this.cache.get(this.defaultCompanyId);
            if (defaultConfigs && defaultConfigs[key]) {
                return defaultConfigs[key];
            }
        }

        // 3. Last Resort Fallback: process.env
        if (process.env[key]) {
            return process.env[key];
        }

        return null;
    }

    /**
     * Retrieve all active configurations merged together
     */
    async getAll(companyId = this.defaultCompanyId) {
        await this._ensureCache(companyId);
        const baseConfigs = this.cache.get(companyId) || {};
        return { ...baseConfigs, ...this.clientOverrides };
    }

    /**
     * Internal: Ensures the cache is populated for the given company.
     */
    async _ensureCache(companyId) {
        const now = Date.now();
        if (this.cache.has(companyId) && (now - this.lastFetch < this.cacheTTL)) {
            return;
        }

        if (!db) return; // Firebase not initialized

        try {
            console.log(`[Config] Fetching fresh configs for company: ${companyId}...`);
            const doc = await db.collection('configs').doc(companyId).get();
            if (doc.exists) {
                this.cache.set(companyId, doc.data());
                this.lastFetch = now;
            } else {
                console.warn(`[Config] No Firestore config found for company: ${companyId}`);
                this.cache.set(companyId, {}); // Avoid repeated empty fetches
            }
        } catch (error) {
            console.error(`[Config] Error fetching from Firestore:`, error.message);
        }
    }

    /**
     * Force refresh the cache.
     */
    refresh() {
        this.cache.clear();
        this.lastFetch = 0;
    }
}

module.exports = new ConfigService();
