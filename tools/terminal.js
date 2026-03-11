const { execSync } = require('child_process');

/**
 * Nexus OS Tool: Terminal
 * Allows the agent to run shell commands.
 */
class TerminalTool {
    static runCommand(command, cwd = process.cwd()) {
        try {
            const output = execSync(command, { cwd, encoding: 'utf8', stdio: 'pipe' });
            return `Command success:\n${output}`;
        } catch (error) {
            return `Command failed:\n${error.stdout || ''}\nError: ${error.stderr || error.message}`;
        }
    }
}

module.exports = TerminalTool;
