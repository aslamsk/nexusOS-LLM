const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const NexusOrchestrator = require('./index');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));
// Expose the outputs directory so users can download generated files
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

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
