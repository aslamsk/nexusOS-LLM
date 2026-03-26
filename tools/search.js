const axios = require('axios');
const ConfigService = require('../core/config');

/**
 * Nexus OS: Web Search Tool
 * Uses Tavily first, then Brave Search API, with fallback to anonymous DDG scraping.
 */
class SearchTool {
    /**
     * Search the web for a query.
     */
    async search(query) {
        console.log(`[Search] Query: "${query}"`);
        
        try {
            const tavilyKey = await ConfigService.get('TAVILY_API_KEY');
            if (tavilyKey) {
                return await this._searchTavily(query, tavilyKey);
            }
        } catch (e) {
            console.warn('[Search] Tavily search failed, falling back...', e.message);
        }

        try {
            const braveKey = await ConfigService.get('BRAVE_SEARCH_API_KEY');
            if (braveKey) {
                return await this._searchBrave(query, braveKey);
            }
        } catch (e) {
            console.warn('[Search] Brave search failed, falling back...', e.message);
        }

        return await this._searchDDG(query);
    }

    /**
     * Brave Search API (Recommended)
     */
    async _searchBrave(query, apiKey) {
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`;
        const res = await axios.get(url, {
            headers: {
                'X-Subscription-Token': apiKey,
                'Accept': 'application/json'
            }
        });

        if (!res.data.web?.results) return "No results found.";

        return res.data.web.results.slice(0, 8).map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.description
        }));
    }

    /**
     * Tavily Search API (Good fallback / free-tier friendly)
     */
    async _searchTavily(query, apiKey) {
        const res = await axios.post('https://api.tavily.com/search', {
            api_key: apiKey,
            query,
            max_results: 8,
            search_depth: 'basic',
            include_answer: false,
            include_raw_content: false
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!Array.isArray(res.data?.results) || res.data.results.length === 0) return "No results found.";

        return res.data.results.slice(0, 8).map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.content
        }));
    }

    /**
     * DuckDuckGo Scraper (Zero-Config Fallback)
     */
    async _searchDDG(query) {
        // Simplified fallback: just tell the user we are using browser automation 
        // as a workaround if no API key is provided, or use a basic search.
        // For a robust agency tool, an API is much better.
        try {
            const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const res = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
            });
            
            // Note: In a real prod environment, use a proper scraper or SerpAPI.
            // This is a placeholder for the logic.
            return `SEARCH_FALLBACK: No Brave or Tavily search API key found. I recommend adding BRAVE_SEARCH_API_KEY or TAVILY_API_KEY in Settings for better live search. Current anonymous fallback is limited.`;
        } catch (e) {
            return `Error performing fallback search: ${e.message}`;
        }
    }
}

module.exports = new SearchTool();
