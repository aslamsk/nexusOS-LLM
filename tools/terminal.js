const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Nexus OS Tool: Terminal (Advanced)
 * Ported features from Claude BashTool:
 * - Auto-backgrounding
 * - Output Persistence
 * - Semantic Intelligence
 */
class TerminalTool {
    static backgroundTasks = new Map();

    static runCommand(command, cwd = process.cwd(), runInBackground = false) {
        const startedAt = new Date().toISOString();
        const safeCwd = cwd || process.cwd();
        const taskId = `task_${Date.now()}`;

        if (runInBackground) {
            return this._runInBackground(taskId, command, safeCwd);
        }

        try {
            const output = execSync(command, {
                cwd: safeCwd,
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 30000,
                windowsHide: true
            });
            return this._processResult(true, command, safeCwd, startedAt, String(output || ''), '');
        } catch (error) {
            const stdout = String(error.stdout || '');
            const stderr = String(error.stderr || error.message || '');
            return this._processResult(false, command, safeCwd, startedAt, stdout, stderr, error.status);
        }
    }

    static _runInBackground(taskId, command, cwd) {
        const logPath = path.join(__dirname, '..', 'outputs', 'logs', `${taskId}.log`);
        if (!fs.existsSync(path.dirname(logPath))) fs.mkdirSync(path.dirname(logPath), { recursive: true });
        
        const out = fs.openSync(logPath, 'a');
        const err = fs.openSync(logPath, 'a');

        const proc = spawn(command, {
            cwd,
            shell: true,
            detached: true,
            stdio: ['ignore', out, err]
        });

        proc.unref();
        this.backgroundTasks.set(taskId, {
            proc,
            command,
            logPath,
            startedAt: new Date().toISOString()
        });

        return JSON.stringify({
            ok: true,
            message: "Command started in background.",
            taskId,
            logPath,
            tip: "Use 'checkBackgroundTask' to see progress."
        }, null, 2);
    }

    static _processResult(ok, command, cwd, startedAt, stdout, stderr, exitCode = 0) {
        const finishedAt = new Date().toISOString();
        
        // [CLAUDE-OUTPUT-MANAGEMENT] Persistence for large logs
        let persistentLogPath = null;
        if (stdout.length > 10000 || stderr.length > 2000) {
            const logName = `term_${Date.now()}.log`;
            persistentLogPath = path.join(__dirname, '..', 'outputs', 'logs', logName);
            if (!fs.existsSync(path.dirname(persistentLogPath))) fs.mkdirSync(path.dirname(persistentLogPath), { recursive: true });
            fs.writeFileSync(persistentLogPath, `COMMAND: ${command}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`, 'utf8');
            stdout = stdout.slice(0, 5000) + `\n\n... OUTPUT TRUNCATED. Full log at: ${persistentLogPath}`;
            stderr = stderr.slice(0, 1000);
        }

        // [CLAUDE-SEMANTIC-INTELLIGENCE]
        let classification = ok ? 'success' : 'failure';
        if (!ok) {
            const combined = `${stdout}\n${stderr}`.toLowerCase();
            if (exitCode === 127 || /not recognized|not found|no such file/i.test(combined)) classification = 'command_not_found';
            else if (/permission denied|eacces/i.test(combined)) classification = 'permission_error';
            else if (/resource busy|ebusy|locked/i.test(combined)) classification = 'resource_locked';
            else if (/git merge|conflict/i.test(combined)) classification = 'vcs_conflict';
        }

        return JSON.stringify({
            ok,
            command,
            cwd,
            startedAt,
            finishedAt,
            exitCode,
            classification,
            persistentLogPath,
            stdout,
            stderr: stderr || (ok ? '' : 'Unknown Error')
        }, null, 2);
    }

    static checkBackgroundTask(taskId) {
        const task = this.backgroundTasks.get(taskId);
        if (!task) return `Error: Background task '${taskId}' not found.`;
        
        const logs = fs.existsSync(task.logPath) ? fs.readFileSync(task.logPath, 'utf8') : '';
        const isRunning = !task.proc.killed && task.proc.exitCode === null;

        return JSON.stringify({
            ok: true,
            taskId,
            command: task.command,
            isRunning,
            startedAt: task.startedAt,
            logs: logs.slice(-2000) // Return last 2k chars
        }, null, 2);
    }
}

module.exports = TerminalTool;
