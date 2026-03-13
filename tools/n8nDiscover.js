const fs = require('fs');
const path = require('path');

/**
 * n8n Workflow Discovery Tool
 * Recursively searches and indexes n8n workflows from the local repository.
 */
class N8nDiscoverTool {
    constructor(basePath) {
        this.basePath = basePath || path.join(__dirname, '..', 'external', 'n8n-workflows', 'workflows');
    }

    /**
     * Recursively find all JSON files in the workflows directory.
     */
    async findAllWorkflows(dir) {
        let results = [];
        const list = await fs.promises.readdir(dir);

        for (const file of list) {
            const filePath = path.join(dir, file);
            const stat = await fs.promises.stat(filePath);

            if (stat && stat.isDirectory()) {
                results = results.concat(await this.findAllWorkflows(filePath));
            } else if (file.endsWith('.json')) {
                results.push(filePath);
            }
        }
        return results;
    }

    /**
     * Search for workflows by keyword in name, description, or tags.
     */
    async searchWorkflows(query) {
        console.log(`[n8nDiscover] Searching for: "${query}"...`);
        const allFiles = await this.findAllWorkflows(this.basePath);
        const matches = [];

        for (const filePath of allFiles) {
            try {
                const content = await fs.promises.readFile(filePath, 'utf8');
                const workflow = JSON.parse(content);
                
                const normalizedQuery = query.toLowerCase();
                const nameMatch = workflow.name && workflow.name.toLowerCase().includes(normalizedQuery);
                const descMatch = workflow.description && workflow.description.toLowerCase().includes(normalizedQuery);
                const tagMatch = workflow.tags && workflow.tags.some(tag => tag.toLowerCase().includes(normalizedQuery));

                if (nameMatch || descMatch || tagMatch) {
                    matches.push({
                        name: workflow.name,
                        path: path.relative(path.join(__dirname, '..'), filePath),
                        description: workflow.description || 'No description available.',
                        tags: workflow.tags || []
                    });
                }
            } catch (err) {
                // Skip invalid JSON or read errors
            }
        }

        return matches.slice(0, 10); // Return top 10 matches
    }

    /**
     * Read a specific workflow by its relative path.
     */
    async getWorkflow(relativePath) {
        const fullPath = path.join(__dirname, '..', relativePath);
        try {
            const content = await fs.promises.readFile(fullPath, 'utf8');
            return JSON.parse(content);
        } catch (err) {
            return { error: `Could not read workflow at ${relativePath}: ${err.message}` };
        }
    }
}

module.exports = new N8nDiscoverTool();
