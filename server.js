const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const NexusOrchestrator = require('./index');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configure multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Keep original name but add timestamp to avoid collisions
        const timestamp = Date.now();
        cb(null, `${timestamp}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// Expose the uploads directory (optional, but good for verification if needed)
app.use('/uploads', express.static(uploadDir));

// File upload endpoint
app.post('/upload', (req, res, next) => {
    console.log(`[Upload] Received POST request to /upload`);
    next();
}, upload.single('file'), (req, res) => {
    if (!req.file) {
        console.log(`[Upload] No file in request`);
        return res.status(400).send({ error: 'No file uploaded' });
    }
    const filePath = path.join(uploadDir, req.file.filename);
    console.log(`[Upload] File saved to: ${filePath}`);
    res.send({ 
        message: 'File uploaded successfully', 
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: filePath 
    });
});

// Expose the outputs directory so users can download generated files
app.use('/outputs', (req, res, next) => {
    console.log(`[Static] Output requested: ${req.url}`);
    // Force download if requested via query param or if it's a non-previewable file
    if (req.query.download) {
        res.setHeader('Content-Disposition', 'attachment');
    }
    next();
}, express.static(path.join(__dirname, 'outputs'), {
    maxAge: '1d'
}));

// Explicit wildcard route for SPA client-side routing and fallback
// Use a regex to bypass path-to-regexp syntax issues in Express 5
app.get(/.*/, (req, res, next) => {
    if (req.path === '/sessions') {
        const files = fs.readdirSync(sessionsBaseDir);
        const sessions = files.map(f => {
            const content = JSON.parse(fs.readFileSync(path.join(sessionsBaseDir, f), 'utf8'));
            return {
                id: content.sessionId,
                lastUpdated: content.lastUpdated,
                preview: content.chatHistory?.[1]?.text?.substring(0, 50) || 'New Mission'
            };
        }).sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
        return res.send(sessions);
    }
    next();
});

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

const sessionsBaseDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsBaseDir)) fs.mkdirSync(sessionsBaseDir, { recursive: true });

io.on('connection', (socket) => {
    console.log('User connected to Web UI');
    let orchestrator = null;
    let sessionDir = null;
    let sessionId = null;

    socket.on('join_session', (data) => {
        sessionId = data.sessionId || `session_${Date.now()}`;
        const sessionMetaFile = path.join(sessionsBaseDir, `${sessionId}.json`);
        let savedState = null;

        if (fs.existsSync(sessionMetaFile)) {
            console.log(`[Session] Resuming persistent session: ${sessionId}`);
            savedState = JSON.parse(fs.readFileSync(sessionMetaFile, 'utf8'));
            sessionDir = savedState.sessionDir;
        }

        if (!sessionDir) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            sessionDir = path.join(__dirname, 'outputs', `session_${timestamp}`);
        }

        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

        orchestrator = new NexusOrchestrator((logEvent) => {
            socket.emit('nexus_log', logEvent);
            // Auto-save on every log event to ensure persistence
            saveSession();
        }, sessionDir);

        if (savedState) {
            orchestrator.restorePersistentState(savedState.orchestratorState);
            socket.emit('session_recovered', { 
                sessionId, 
                history: savedState.chatHistory || [],
                logs: savedState.logs || []
            });
        } else {
            socket.emit('session_created', { sessionId });
        }
        
        updateOutputsList();
    });

    const saveSession = () => {
        if (!sessionId || !orchestrator) return;
        const sessionMetaFile = path.join(sessionsBaseDir, `${sessionId}.json`);
        // We'll need to capture the chat history and logs from the frontend or track them here.
        // For now, let's at least save the orchestrator internal state.
        const state = {
            sessionId,
            sessionDir,
            orchestratorState: orchestrator.getPersistentState(),
            // history and logs should be sent by client periodically or tracked by server
            lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(sessionMetaFile, JSON.stringify(state, null, 2));
    };

    socket.on('start_task', async (data) => {
        const { prompt } = data;
        if (!orchestrator) return;
        console.log(`Received task: ${prompt}`);
        try {
            await orchestrator.execute(prompt);
            updateOutputsList();
            saveSession();
        } catch (error) {
            socket.emit('nexus_log', { type: 'error', message: `Orchestrator Error: ${error.message}` });
        }
    });

    socket.on('user_input', async (data) => {
        const { prompt } = data;
        if (!orchestrator) return;
        try {
            await orchestrator.resume(prompt);
            updateOutputsList();
            saveSession();
        } catch (error) {
            socket.emit('nexus_log', { type: 'error', message: `Orchestrator Error: ${error.message}` });
        }
    });

    socket.on('sync_history', (data) => {
        // Client sends full history for deep persistence
        if (!sessionId) return;
        const sessionMetaFile = path.join(sessionsBaseDir, `${sessionId}.json`);
        if (fs.existsSync(sessionMetaFile)) {
            const state = JSON.parse(fs.readFileSync(sessionMetaFile, 'utf8'));
            state.chatHistory = data.history;
            state.logs = data.logs;
            fs.writeFileSync(sessionMetaFile, JSON.stringify(state, null, 2));
        }
    });

    const updateOutputsList = () => {
        if (fs.existsSync(sessionDir)) {
            const files = fs.readdirSync(sessionDir);
            const folderName = path.basename(sessionDir);
            socket.emit('outputs_list', {
                files: files.map(f => ({ name: f, url: `/outputs/${folderName}/${f}` }))
            });
        }
    };

    socket.on('get_outputs', updateOutputsList);

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Nexus OS Web Interface running on http://localhost:${PORT}`);
});
