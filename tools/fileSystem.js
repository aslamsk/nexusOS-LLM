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

    static readFile(absolutePath) {
        try {
            return fs.readFileSync(absolutePath, 'utf8');
        } catch (error) {
            return `Error reading file: ${error.message}`;
        }
    }

    static writeFile(absolutePath, content) {
        try {
            const dir = path.dirname(absolutePath);
            this._ensureDir(dir);
            const previousContent = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : '';
            const snapshotPath = fs.existsSync(absolutePath) ? this._createSnapshot(absolutePath, previousContent) : null;
            fs.writeFileSync(absolutePath, content, 'utf8');
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
            return fs.readdirSync(absolutePath).join('\n');
        } catch (error) {
            return `Error listing directory: ${error.message}`;
        }
    }

    static replaceFileContent(absolutePath, startLine, endLine, targetContent, replacementContent) {
        try {
            let lines = fs.readFileSync(absolutePath, 'utf8').split('\n');
            const originalContent = lines.join('\n');
            const targetSection = lines.slice(startLine - 1, endLine).join('\n');
            
            if (targetSection.trim() !== targetContent.trim()) {
                // Relaxed check: if exact match fails, show what was found to help the agent
                return `Error: TargetContent does not match the content at lines ${startLine}-${endLine}.\nFound:\n${targetSection}`;
            }

            const before = lines.slice(0, startLine - 1);
            const after = lines.slice(endLine);
            const newLines = [...before, replacementContent, ...after];
            const updatedContent = newLines.join('\n');
            const snapshotPath = this._createSnapshot(absolutePath, originalContent);
            fs.writeFileSync(absolutePath, newLines.join('\n'), 'utf8');
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
