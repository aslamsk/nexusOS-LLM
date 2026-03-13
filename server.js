const express = require('express');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const path = require('path');
const NexusOrchestrator = require('./index');
const DataService = require('./core/jarvis/dataService');

const cors = require('cors');

const app = express();
app.use(cors({ origin: "http://localhost:3001", credentials: true }));
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3001",
        methods: ["GET", "POST"],
        credentials: true
    }
});

const db = new DataService(path.join(__dirname, 'data'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
// Expose the outputs directory so users can download generated files
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

// --- NEXUS API ---
app.get('/api/projects', async (req, res) => res.json(await db.getProjects()));
app.get('/api/tasks/:projectId', async (req, res) => res.json(await db.getTasks(req.params.projectId)));
app.get('/api/artifacts/:projectId', async (req, res) => {
    const arts = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'artifacts.json'), 'utf8'));
    res.json(arts.filter(a => a.projectId === req.params.projectId));
});

app.post('/api/tasks/:taskId/approve', async (req, res) => {
    const { taskId } = req.params;
    console.log(`[SERVER] Approving task: ${taskId}`);
    try {
        await db.updateTaskStatus(taskId, 'completed');
        io.emit('nexus-update', { type: 'task_approved', taskId });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/projects/:projectId', async (req, res) => {
    const { projectId } = req.params;
    console.log(`[SERVER] Nuclear Cleanup Request: Project ${projectId}`);
    try {
        await db.deleteProject(projectId);
        io.emit('nexus-update', { type: 'project_deleted', projectId });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/orchestrate', async (req, res) => {
    const { goal } = req.body;
    if (!goal) return res.status(400).json({ error: 'Goal is required' });
    
    // We run this as a promise so we can return early or track progress
    // In a real scenario, we'd use socket.io for real-time progress
    try {
        const orchestrator = new NexusOrchestrator((update) => {
            console.log(`[ORCHESTRATOR UPDATE]`, JSON.stringify(update));
            io.emit('nexus_log', update);
            io.emit('nexus-update', update);
        });
        // Run execution in the background
        console.log(`[SERVER] Starting orchestration for goal: ${goal}`);
        orchestrator.execute(`Strategic Objective: ${goal}\n\nPlease use your jarvisExecute tool to plan and execute this goal.`);
        res.json({ success: true, message: 'Orchestration started' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

io.on('connection', (socket) => {
    console.log('User connected to Web UI');

    // Create a unique output folder for this entire session
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
