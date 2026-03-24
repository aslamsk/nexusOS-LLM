const { execSync } = require('child_process');

/**
 * Nexus OS Tool: Terminal
 * Allows the agent to run shell commands.
 */
class TerminalTool {
    static runCommand(command, cwd = process.cwd()) {
        const startedAt = new Date().toISOString();
        const safeCwd = cwd || process.cwd();
        try {
            const output = execSync(command, {
                cwd: safeCwd,
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 30000,
                windowsHide: true
            });
            return JSON.stringify({
                ok: true,
                command,
                cwd: safeCwd,
                startedAt,
                finishedAt: new Date().toISOString(),
                stdout: String(output || '').slice(0, 6000),
                stderr: '',
                classification: 'success'
            }, null, 2);
        } catch (error) {
            const stdout = String(error.stdout || '').slice(0, 4000);
            const stderr = String(error.stderr || error.message || '').slice(0, 4000);
            const classification =
                error.signal === 'SIGTERM' ? 'timeout' :
                /not recognized|cannot find|not found/i.test(`${stdout}\n${stderr}`) ? 'command_not_found' :
                /access is denied|permission/i.test(`${stdout}\n${stderr}`) ? 'permission' :
                'failure';

            return JSON.stringify({
                ok: false,
                command,
                cwd: safeCwd,
                startedAt,
                finishedAt: new Date().toISOString(),
                stdout,
                stderr,
                exitCode: typeof error.status === 'number' ? error.status : null,
                classification
            }, null, 2);
        }
    }
}

module.exports = TerminalTool;
