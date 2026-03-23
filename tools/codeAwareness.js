const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Nexus OS: Code Intelligence Tool
 * Enhances agent understanding of large codebases.
 */
class CodeAwarenessTool {
    /**
     * Recursively list files in a directory with basic metadata.
     */
    async mapCodebase(absolutePath, maxDepth = 3) {
        console.log(`[CodeAwareness] Mapping codebase at ${absolutePath} (depth: ${maxDepth})`);
        const result = [];
        
        function traverse(currPath, depth) {
            if (depth > maxDepth) return;
            const items = fs.readdirSync(currPath);
            for (const item of items) {
                if (item === 'node_modules' || item === '.git' || item === 'dist') continue;
                const fullPath = path.join(currPath, item);
                const stats = fs.statSync(fullPath);
                if (stats.isDirectory()) {
                    result.push({ type: 'dir', path: fullPath, depth });
                    traverse(fullPath, depth + 1);
                } else {
                    result.push({ type: 'file', path: fullPath, size: stats.size });
                }
            }
        }

        try {
            traverse(absolutePath, 0);
            return result;
        } catch (e) {
            return `Error mapping codebase: ${e.message}`;
        }
    }

    /**
     * Search for a string or regex across all files in a directory.
     * Uses 'grep' (on Linux/Mac) or a JS fallback.
     */
    async searchInCode(absolutePath, query) {
        console.log(`[CodeAwareness] Searching for "${query}" in ${absolutePath}`);
        try {
            // Use git grep if available for speed, otherwise fallback to a naive search
            try {
                const output = execSync(`git grep -n "${query}"`, { cwd: absolutePath, encoding: 'utf8' });
                return output || "No matches found.";
            } catch (e) {
                // Fallback to simple grep-like scan if git grep fails
                const files = this._getAllFiles(absolutePath);
                const matches = [];
                for (const file of files) {
                    const content = fs.readFileSync(file, 'utf8');
                    const lines = content.split('\n');
                    lines.forEach((line, idx) => {
                        if (line.includes(query)) {
                            matches.push(`${path.relative(absolutePath, file)}:${idx + 1}: ${line.trim()}`);
                        }
                    });
                    if (matches.length > 50) break; // Cap results
                }
                return matches.join('\n') || "No matches found.";
            }
        } catch (e) {
            return `Error searching code: ${e.message}`;
        }
    }

    /**
     * Locate a function definition across the codebase.
     */
    async findFunction(absolutePath, functionName) {
        const query = `function ${functionName}|${functionName}\\s*=\\s*(async\\s+)?function|${functionName}\\s*:\\s*(async\\s+)?function|${functionName}\\s*\\(.*\\)\\s*{`;
        return await this.searchInCode(absolutePath, query);
    }

    /**
     * Internal helper to recursively get all relevant code files.
     */
    _getAllFiles(dir, fileList = []) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const name = path.join(dir, file);
            if (fs.statSync(name).isDirectory()) {
                if (file !== 'node_modules' && file !== '.git') {
                    this._getAllFiles(name, fileList);
                }
            } else {
                if (/\.(js|ts|vue|html|css|py|md|json)$/.test(file)) {
                    fileList.push(name);
                }
            }
        });
        return fileList;
    }
}

module.exports = new CodeAwarenessTool();
