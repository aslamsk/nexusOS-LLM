const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const NexusOrchestrator = require('./index');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
// Expose the outputs directory so users can download generated files
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

io.on('connection', (socket) => {
    console.log('User connected to Web UI');

    socket.on('start_task', async (data) => {
        const { prompt } = data;
        console.log(`Received task from Web UI: ${prompt}`);

        // Create a unique output folder for this task
        const fs = require('fs');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const taskDir = path.join(__dirname, 'outputs', `task_${timestamp}`);
        if (!fs.existsSync(taskDir)) {
            fs.mkdirSync(taskDir, { recursive: true });
        }

        // Initialize a new orchestrator instance for this task
        const orchestrator = new NexusOrchestrator((logEvent) => {
            // Stream logs back to the client in real-time
            socket.emit('nexus_log', logEvent);
        }, taskDir);

        try {
            await orchestrator.execute(prompt);
        } catch (error) {
            socket.emit('nexus_log', { type: 'error', message: `Orchestrator Error: ${error.message}` });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Nexus OS Web Interface running on http://localhost:${PORT}`);
});
