const fs = require('fs');
const path = require('path');

/**
 * Nexus OS: Node-based Grep Fallback
 * Used when ripgrep (rg) is unavailable. 
 * Performs a recursive, line-by-line search in the specified directory.
 */
function searchNode(query, searchPath, includes = []) {
    const results = [];
    const maxResults = 50;

    function walk(dir) {
        if (results.length >= maxResults) return;

        const files = fs.readdirSync(dir);
        for (const file of files) {
            if (results.length >= maxResults) break;
            const fullPath = path.join(dir, file);
            const stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
                if (file !== 'node_modules' && !file.startsWith('.')) {
                    walk(fullPath);
                }
            } else if (stats.isFile()) {
                // Check if file matches inclusion patterns
                if (includes.length > 0) {
                    const ext = path.extname(file);
                    if (!includes.some(inc => ext === inc || file.endsWith(inc))) continue;
                }

                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const lines = content.split('\n');
                    lines.forEach((line, idx) => {
                        if (line.includes(query)) {
                            results.push({
                                file: fullPath,
                                line: idx + 1,
                                content: line.trim()
                            });
                        }
                    });
                } catch (e) {
                    // Skip binary/unreadable files
                }
            }
        }
    }

    try {
        walk(searchPath);
    } catch (e) {
        console.error(`[Search Fallback] Error walking ${searchPath}: ${e.message}`);
    }

    return results;
}

module.exports = { searchNode };
