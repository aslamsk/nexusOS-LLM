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
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

io.on('connection', (socket) => {
    console.log('User connected to Web UI');

    // Create a unique output folder for this entire session
    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionDir = path.join(__dirname, 'outputs', `session_${timestamp}`);
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Initialize ONE orchestrator instance for this user session
    // This allows the agent to remember context from previous questions
    const orchestrator = new NexusOrchestrator((logEvent) => {
        // Stream logs back to the client in real-time
        socket.emit('nexus_log', logEvent);
    }, sessionDir);

    socket.on('start_task', async (data) => {
        const { prompt } = data;
        console.log(`Received task from Web UI: ${prompt}`);

        try {
            await orchestrator.execute(prompt);
            // After execute or pause, send updated outputs list
            updateOutputsList();
        } catch (error) {
            socket.emit('nexus_log', { type: 'error', message: `Orchestrator Error: ${error.message}` });
        }
    });

    socket.on('user_input', async (data) => {
        const { prompt } = data;
        console.log(`Received user input from Web UI: ${prompt}`);

        try {
            await orchestrator.resume(prompt);
            updateOutputsList();
        } catch (error) {
            socket.emit('nexus_log', { type: 'error', message: `Orchestrator Error: ${error.message}` });
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
