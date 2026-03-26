class SelfHealingService {
    classify(toolCall, resultString) {
        const name = toolCall?.name || 'unknown';
        const text = String(resultString || '').toLowerCase();

        if (!text) return null;

        if (
            name === 'browserAction' &&
            (
                text.includes('not found') ||
                text.includes('failed') ||
                text.includes('selector') ||
                text.includes('requires selector') ||
                text.includes('unknown browser action')
            )
        ) {
            return {
                type: 'browser_mismatch',
                severity: 'medium',
                summary: 'Browser interaction did not match the current page state.'
            };
        }

        if (text.includes('missing page id') || text.includes('missing') || text.includes('not initialized')) {
            return {
                type: 'configuration_gap',
                severity: 'medium',
                summary: 'The task is blocked by missing credentials or required configuration.'
            };
        }

        if (name === 'runCommand' && (text.includes('is not recognized') || text.includes('cannot find') || text.includes('command failed'))) {
            return {
                type: 'command_failure',
                severity: 'medium',
                summary: 'The shell command failed and may need a safer fallback or path adjustment.'
            };
        }

        if (text.includes('timeout') || text.includes('timed out') || text.includes('network did not become fully idle')) {
            return {
                type: 'timeout',
                severity: 'medium',
                summary: 'The task appears to be waiting on a timeout-sensitive dependency.'
            };
        }

        if (text.includes('approval required')) {
            return {
                type: 'approval_gate',
                severity: 'low',
                summary: 'The task is paused behind a Boss approval gate.'
            };
        }

        return null;
    }

    getPlaybook(classification, toolCall) {
        if (!classification) return null;

        switch (classification.type) {
            case 'browser_mismatch':
                return {
                    strategy: 'auto_scan',
                    safe: true,
                    message: 'Run browser element extraction and retry with updated page context.'
                };
            case 'timeout':
                return {
                    strategy: 'wait_and_retry',
                    safe: true,
                    message: 'Wait for the page/network to settle, then retry the current step.'
                };
            case 'command_failure':
                return {
                    strategy: 'boss_repair_mode',
                    safe: false,
                    message: `The command failed. Proposed repair: review command "${toolCall?.args?.command || ''}" and adjust before retrying.`
                };
            case 'configuration_gap':
                return {
                    strategy: 'boss_repair_mode',
                    safe: false,
                    message: 'The task needs a missing credential or setup value before it can continue.'
                };
            default:
                return null;
        }
    }
}

module.exports = new SelfHealingService();
