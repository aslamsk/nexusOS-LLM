const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Nexus OS: Worktree Isolation Tool
 * Ported from Claude AgentTool architecture.
 * Ensures agents work in isolated git worktrees to prevent corruption
 * of the main branch during autonomous missions.
 */
class WorktreeManager {
    static snapshotsDir = path.join(__dirname, '..', 'outputs', 'worktrees');

    /**
     * Create an isolated worktree for a specific task.
     */
    static createWorktree(taskId, branch = 'main') {
        const worktreePath = path.join(this.snapshotsDir, taskId);
        const newBranch = `mission/${taskId}`;

        try {
            console.log(`[Worktree] Creating isolated enclave for task ${taskId}...`);
            
            if (!this._isGitRepo()) {
                throw new Error("Target is not a git repository. Worktree isolation requires Git.");
            }

            // Create worktree
            execSync(`git worktree add -b ${newBranch} "${worktreePath}" ${branch}`, {
                stdio: 'pipe',
                encoding: 'utf8'
            });

            return JSON.stringify({
                ok: true,
                taskId,
                worktreePath,
                branch: newBranch,
                message: "Isolated worktree created successfully."
            }, null, 2);
        } catch (error) {
            return JSON.stringify({
                ok: false,
                error: error.message,
                tip: "Ensure git is installed and common branch is 'main'."
            }, null, 2);
        }
    }

    /**
     * Clean up a worktree after mission completion.
     */
    static removeWorktree(taskId, deleteBranch = true) {
        const worktreePath = path.join(this.snapshotsDir, taskId);
        try {
            console.log(`[Worktree] Removing enclave ${taskId}...`);
            execSync(`git worktree remove --force "${worktreePath}"`, { stdio: 'pipe' });
            
            if (deleteBranch) {
                execSync(`git branch -D mission/${taskId}`, { stdio: 'pipe' });
            }

            return JSON.stringify({ ok: true, message: `Worktree ${taskId} removed.` });
        } catch (error) {
            return JSON.stringify({ ok: false, error: error.message });
        }
    }

    /**
     * Finalize and merge changes from a worktree into the base branch.
     * Performs git add, commit, and merge.
     */
    static finalizeWorktree(taskId, commitMessage = "Nexus OS: Mission complete", baseBranch = 'main') {
        const worktreePath = path.join(this.snapshotsDir, taskId);
        const missionBranch = `mission/${taskId}`;

        try {
            console.log(`[Worktree] Finalizing enclave ${taskId} and merging to ${baseBranch}...`);

            // 1. Stage and Commit in the worktree
            execSync(`git -C "${worktreePath}" add .`, { stdio: 'pipe' });
            try {
                execSync(`git -C "${worktreePath}" commit -m "${commitMessage}"`, { stdio: 'pipe' });
            } catch (e) {
                console.log("[Worktree] Nothing to commit, proceeding with merge/cleanup.");
            }

            // 2. Remove worktree
            this.removeWorktree(taskId, false);

            // 3. Merge mission branch into base
            console.log(`[Git] Merging ${missionBranch} into ${baseBranch}...`);
            execSync(`git checkout ${baseBranch}`, { stdio: 'pipe' });
            execSync(`git merge ${missionBranch}`, { stdio: 'pipe' });
            
            // 4. Cleanup mission branch
            execSync(`git branch -D ${missionBranch}`, { stdio: 'pipe' });

            return JSON.stringify({
                ok: true,
                taskId,
                message: "Mission changes merged successfully into main branch."
            }, null, 2);
        } catch (error) {
            return JSON.stringify({
                ok: false,
                error: error.message,
                tip: "A merge conflict occurred. Please resolve manually or ask Nexus to 'Repair Merge'."
            }, null, 2);
        }
    }
}

module.exports = WorktreeManager;
