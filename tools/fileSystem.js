const fs = require('fs');
const path = require('path');

/**
 * Nexus OS Tool: FileSystem
 * Provides low-level file manipulation for the agent.
 */
class FileSystemTool {
    static _snapshotRoot() {
        return path.join(__dirname, '..', 'outputs', '_snapshots');
    }

    static _ensureDir(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    static _createSnapshot(absolutePath, previousContent) {
        const snapshotDir = this._snapshotRoot();
        this._ensureDir(snapshotDir);
        const safeName = path.basename(absolutePath).replace(/[^\w.-]/g, '_');
        const snapshotPath = path.join(snapshotDir, `${Date.now()}_${safeName}.bak`);
        fs.writeFileSync(snapshotPath, previousContent, 'utf8');
        return snapshotPath;
    }

    static _summarizeDiff(before, after) {
        const beforeLines = String(before || '').split('\n');
        const afterLines = String(after || '').split('\n');
        return {
            beforeLineCount: beforeLines.length,
            afterLineCount: afterLines.length,
            beforePreview: beforeLines.slice(0, 8).join('\n').slice(0, 400),
            afterPreview: afterLines.slice(0, 8).join('\n').slice(0, 400)
        };
    }

    static readFile(absolutePath, stateMap = null, turn = 0) {
        try {
            const stats = fs.statSync(absolutePath);
            const content = fs.readFileSync(absolutePath, 'utf8');
            
            // [CLAUDE-STALENESS-GUARD] Record state for future validation
            if (stateMap) {
                stateMap.set(absolutePath, {
                    mtime: stats.mtimeMs,
                    size: stats.size,
                    readAtTurn: turn
                });
            }

            return JSON.stringify({
                ok: true,
                action: 'readFile',
                absolutePath,
                size: content.length,
                mtime: stats.mtimeMs,
                content: content.slice(0, 8000) // Increased slightly for better context
            }, null, 2);
        } catch (error) {
            return JSON.stringify({ ok: false, action: 'readFile', absolutePath, error: error.message, classification: 'permission_or_missing' }, null, 2);
        }
    }

    static writeFile(absolutePath, content, stateMap = null) {
        try {
            // [CLAUDE-STALENESS-GUARD] Validate before destructive write
            if (stateMap && stateMap.has(absolutePath)) {
                const state = stateMap.get(absolutePath);
                const currentStats = fs.existsSync(absolutePath) ? fs.statSync(absolutePath) : null;
                if (currentStats && currentStats.mtimeMs > state.mtime) {
                    return `Error: File '${absolutePath}' has been modified externally since it was last read. Please re-read the file before writing to ensure consistency.`;
                }
            }

            const dir = path.dirname(absolutePath);
            this._ensureDir(dir);
            const previousContent = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : '';
            const snapshotPath = fs.existsSync(absolutePath) ? this._createSnapshot(absolutePath, previousContent) : null;
            fs.writeFileSync(absolutePath, content, 'utf8');
            
            // Update state map after successful write
            if (stateMap) {
                const newStats = fs.statSync(absolutePath);
                stateMap.set(absolutePath, { mtime: newStats.mtimeMs, size: newStats.size });
            }

            return JSON.stringify({
                ok: true,
                action: 'writeFile',
                absolutePath,
                snapshotPath,
                ...this._summarizeDiff(previousContent, content)
            }, null, 2);
        } catch (error) {
            return `Error writing file: ${error.message}`;
        }
    }

    static listDir(absolutePath) {
        try {
            const files = fs.readdirSync(absolutePath);
            return JSON.stringify({
                ok: true,
                action: 'listDir',
                absolutePath,
                count: files.length,
                files
            }, null, 2);
        } catch (error) {
            return JSON.stringify({ ok: false, action: 'listDir', absolutePath, error: error.message, classification: 'permission_or_missing' }, null, 2);
        }
    }

    static replaceFileContent(absolutePath, startLine, endLine, targetContent, replacementContent, stateMap = null) {
        try {
            // [CLAUDE-STALENESS-GUARD]
            if (stateMap && stateMap.has(absolutePath)) {
                const state = stateMap.get(absolutePath);
                const currentStats = fs.statSync(absolutePath);
                if (currentStats.mtimeMs > state.mtime) {
                    return `Error: File '${absolutePath}' is stale. Please re-read it before making surgical edits.`;
                }
            }

            let lines = fs.readFileSync(absolutePath, 'utf8').split('\n');
            const originalContent = lines.join('\n');
            const targetSection = lines.slice(startLine - 1, endLine).join('\n');
            
            // [CLAUDE-QUOTE-NORMALIZATION] Fuzzy match for quotes and whitespace
            const normalize = (s) => s.replace(/['"“”‘’]/g, "'").replace(/\s+/g, ' ').trim();
            
            if (normalize(targetSection) !== normalize(targetContent)) {
                return `Error: TargetContent does not match. (Normalization: Multi-line/Quote variants detected).\nFound:\n${targetSection}`;
            }

            const before = lines.slice(0, startLine - 1);
            const after = lines.slice(endLine);
            const newLines = [...before, replacementContent, ...after];
            const updatedContent = newLines.join('\n');
            const snapshotPath = this._createSnapshot(absolutePath, originalContent);
            fs.writeFileSync(absolutePath, updatedContent, 'utf8');

            if (stateMap) {
                const newStats = fs.statSync(absolutePath);
                stateMap.set(absolutePath, { mtime: newStats.mtimeMs, size: newStats.size });
            }

            return JSON.stringify({
                ok: true,
                action: 'replaceFileContent',
                absolutePath,
                startLine,
                endLine,
                snapshotPath,
                ...this._summarizeDiff(originalContent, updatedContent)
            }, null, 2);
        } catch (error) {
            return `Error replacing file content: ${error.message}`;
        }
    }

    static runSed(absolutePath, pattern, replacement, stateMap = null) {
        try {
             // [CLAUDE-SED-EMULATION]
            if (stateMap && stateMap.has(absolutePath)) {
                const state = stateMap.get(absolutePath);
                const currentStats = fs.statSync(absolutePath);
                if (currentStats.mtimeMs > state.mtime) {
                    return `Error: File '${absolutePath}' is stale. Re-read before running stream edits.`;
                }
            }

            const content = fs.readFileSync(absolutePath, 'utf8');
            const regex = new RegExp(pattern, 'g');
            const updatedContent = content.replace(regex, replacement);
            
            if (content === updatedContent) {
                return "Warning: Pattern did not match any content. No changes made.";
            }

            const snapshotPath = this._createSnapshot(absolutePath, content);
            fs.writeFileSync(absolutePath, updatedContent, 'utf8');

            if (stateMap) {
                const newStats = fs.statSync(absolutePath);
                stateMap.set(absolutePath, { mtime: newStats.mtimeMs, size: newStats.size });
            }

            return JSON.stringify({
                ok: true,
                action: 'runSed',
                absolutePath,
                snapshotPath,
                matches: (content.match(regex) || []).length
            }, null, 2);
        } catch (error) {
            return `Error running sed: ${error.message}`;
        }
    }

    static multiReplaceFileContent(absolutePath, chunks) {
        try {
            let content = fs.readFileSync(absolutePath, 'utf8');
            const originalContent = content;
            let lines = content.split('\n');
            
            // Sort chunks by startLine descending to avoid offset issues
            const sortedChunks = [...chunks].sort((a, b) => b.startLine - a.startLine);

            for (const chunk of sortedChunks) {
                const { startLine, endLine, targetContent, replacementContent } = chunk;
                const targetSection = lines.slice(startLine - 1, endLine).join('\n');

                if (targetSection.trim() !== targetContent.trim()) {
                    return `Error in multi-replace: TargetContent for lines ${startLine}-${endLine} does not match.\nFound:\n${targetSection}`;
                }

                const before = lines.slice(0, startLine - 1);
                const after = lines.slice(endLine);
                lines = [...before, replacementContent, ...after];
            }

            const updatedContent = lines.join('\n');
            const snapshotPath = this._createSnapshot(absolutePath, originalContent);
            fs.writeFileSync(absolutePath, updatedContent, 'utf8');
            return JSON.stringify({
                ok: true,
                action: 'multiReplaceFileContent',
                absolutePath,
                replacements: chunks.length,
                snapshotPath,
                ...this._summarizeDiff(originalContent, updatedContent)
            }, null, 2);
        } catch (error) {
            return `Error in multi-replace: ${error.message}`;
        }
    }
}

module.exports = FileSystemTool;
