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
}

module.exports = FileSystemTool;
