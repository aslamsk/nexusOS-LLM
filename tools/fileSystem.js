const fs = require('fs');
const path = require('path');

/**
 * Nexus OS Tool: FileSystem
 * Provides low-level file manipulation for the agent.
 */
class FileSystemTool {
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
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(absolutePath, content, 'utf8');
            return `Successfully wrote to ${absolutePath}`;
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
            const targetSection = lines.slice(startLine - 1, endLine).join('\n');
            
            if (targetSection.trim() !== targetContent.trim()) {
                // Relaxed check: if exact match fails, show what was found to help the agent
                return `Error: TargetContent does not match the content at lines ${startLine}-${endLine}.\nFound:\n${targetSection}`;
            }

            const before = lines.slice(0, startLine - 1);
            const after = lines.slice(endLine);
            const newLines = [...before, replacementContent, ...after];
            
            fs.writeFileSync(absolutePath, newLines.join('\n'), 'utf8');
            return `Successfully updated ${absolutePath} at lines ${startLine}-${endLine}.`;
        } catch (error) {
            return `Error replacing file content: ${error.message}`;
        }
    }

    static multiReplaceFileContent(absolutePath, chunks) {
        try {
            let content = fs.readFileSync(absolutePath, 'utf8');
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

            fs.writeFileSync(absolutePath, lines.join('\n'), 'utf8');
            return `Successfully performed ${chunks.length} replacements in ${absolutePath}.`;
        } catch (error) {
            return `Error in multi-replace: ${error.message}`;
        }
    }
}

module.exports = FileSystemTool;
