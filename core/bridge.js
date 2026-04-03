const EventEmitter = require('events');

/**
 * Nexus OS: IDE Bridge Service
 * Allows for bi-directional communication between Nexus OS and IDEs (VS Code/JetBrains).
 * Implements a simplified JSON-RPC long-polling protocol.
 */
class IDEBridge extends EventEmitter {
    constructor() {
        super();
        this.sessions = new Map(); // sessionId -> { lastHeartbeat, queuedActions }
        this.HEARTBEAT_TIMEOUT = 30000; // 30 seconds
    }

    /**
     * Register a new IDE session (e.g., when a VS Code extension connects).
     */
    registerSession(sessionId) {
        console.log(`[Bridge] Registering IDE session: ${sessionId}`);
        this.sessions.set(sessionId, {
            lastHeartbeat: Date.now(),
            queuedActions: []
        });
    }

    /**
     * Post a heartbeat from the IDE.
     */
    heartbeat(sessionId) {
        if (!this.sessions.has(sessionId)) this.registerSession(sessionId);
        const session = this.sessions.get(sessionId);
        session.lastHeartbeat = Date.now();
        
        // Return queued actions to the IDE
        const actions = [...session.queuedActions];
        session.queuedActions = [];
        return actions;
    }

    /**
     * Queue an action for the IDE to perform (e.g., "Open File and Scroll to Line").
     */
    sendToIDE(sessionId, action, params = {}) {
        if (!this.sessions.has(sessionId)) return false;
        this.sessions.get(sessionId).queuedActions.push({ action, params, timestamp: Date.now() });
        return true;
    }

    /**
     * Handle state sync from IDE (e.g., file opened, cursor moved).
     */
    handleIDESync(sessionId, eventType, data) {
        console.log(`[Bridge] Received sync from IDE [${sessionId}]: ${eventType}`);
        this.emit(`ide_event_${sessionId}`, { eventType, data });
        this.emit('ide_event', { sessionId, eventType, data });
    }

    /**
     * Get aggregate status of the bridge for diagnostics.
     */
    getStatus() {
        const now = Date.now();
        const active = [];
        const stale = [];

        for (const [id, session] of this.sessions.entries()) {
            if (now - session.lastHeartbeat < 10000) active.push(id);
            else stale.push(id);
        }

        return {
            totalSessions: this.sessions.size,
            activeCount: active.length,
            staleCount: stale.length,
            isHealthy: this.sessions.size > 0 && active.length > 0
        };
    }

    /**
     * Cleanup stale sessions.
     */
    cleanup() {
        const now = Date.now();
        for (const [id, session] of this.sessions.entries()) {
            if (now - session.lastHeartbeat > this.HEARTBEAT_TIMEOUT) {
                console.log(`[Bridge] Session ${id} timed out.`);
                this.sessions.delete(id);
                this.emit('session_timeout', id);
            }
        }
    }
}

module.exports = new IDEBridge();
