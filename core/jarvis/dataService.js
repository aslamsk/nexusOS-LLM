const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Nexus Data Service
 * 
 * Local-first database replacement for Jarvis (Mimics Firestore).
 */
class DataService {
    static cache = {
        projects: [],
        tasks: [],
        artifacts: [],
        insights: []
    };
    static cacheLoaded = false;

    constructor(dataDir) {
        this.dataDir = dataDir;
        this.projectsFile = path.join(dataDir, 'projects.json');
        this.tasksFile = path.join(dataDir, 'tasks.json');
        this.artifactsFile = path.join(dataDir, 'artifacts.json');
        this.insightsFile = path.join(dataDir, 'insights.json');
        
        this._ensureFiles();
        if (!DataService.cacheLoaded) {
            this._loadCache();
            DataService.cacheLoaded = true;
        }
    }

    _ensureFiles() {
        if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
        [this.projectsFile, this.tasksFile, this.artifactsFile, this.insightsFile].forEach(f => {
            if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify([]));
        });
    }

    _loadCache() {
        try {
            DataService.cache.projects = JSON.parse(fs.readFileSync(this.projectsFile, 'utf8'));
            DataService.cache.tasks = JSON.parse(fs.readFileSync(this.tasksFile, 'utf8'));
            DataService.cache.artifacts = JSON.parse(fs.readFileSync(this.artifactsFile, 'utf8'));
            DataService.cache.insights = JSON.parse(fs.readFileSync(this.insightsFile, 'utf8'));
            console.log(`[DataService] Shared Static Cache loaded. Tasks: ${DataService.cache.tasks.length}`);
        } catch (e) {
            console.error("[DataService] Failed to load cache:", e);
        }
    }

    _write(file, key, data) {
        DataService.cache[key] = data;
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }

    // --- PROJECTS ---
    async createProject(name, description) {
        const project = { 
            id: uuidv4(), 
            name, 
            description, 
            status: 'planning', 
            createdAt: Date.now(), 
            updatedAt: Date.now() 
        };
        const projects = [...DataService.cache.projects, project];
        this._write(this.projectsFile, 'projects', projects);
        return project;
    }

    async getProjects() { return DataService.cache.projects; }

    async deleteProject(projectId) {
        console.log(`[DataService] Nuclear Deletion: Project ${projectId}`);
        
        // 1. Filter out the project
        const projects = DataService.cache.projects.filter(p => p.id !== projectId);
        this._write(this.projectsFile, 'projects', projects);

        // 2. Filter out associated tasks
        const tasks = DataService.cache.tasks.filter(t => t.projectId !== projectId);
        this._write(this.tasksFile, 'tasks', tasks);

        // 3. Filter out associated artifacts
        const artifacts = DataService.cache.artifacts.filter(a => a.projectId !== projectId);
        this._write(this.artifactsFile, 'artifacts', artifacts);

        console.log(`[DataService] Project ${projectId} and associated data successfully purged.`);
    }

    // --- TASKS ---
    async createTask(projectId, role, title, description) {
        const task = { 
            id: uuidv4(), 
            projectId, 
            role, 
            title, 
            description, 
            status: 'pending', 
            createdAt: Date.now(), 
            updatedAt: Date.now() 
        };
        const tasks = [...DataService.cache.tasks, task];
        this._write(this.tasksFile, 'tasks', tasks);
        console.log(`[DataService] Task created in Static Cache: ${task.id} (${title})`);
        return task;
    }

    async getTasks(projectId) {
        if (!projectId) return DataService.cache.tasks;
        return DataService.cache.tasks.filter(t => t.projectId === projectId);
    }

    async updateTaskStatus(taskId, status) {
        const tasks = DataService.cache.tasks.map(t => 
            t.id === taskId ? { ...t, status, updatedAt: Date.now() } : t
        );
        this._write(this.tasksFile, 'tasks', tasks);
    }

    // --- ARTIFACTS ---
    async createArtifact(projectId, taskId, title, content, type) {
        const artifact = { id: uuidv4(), projectId, taskId, title, content, type, createdAt: Date.now() };
        const artifacts = [...DataService.cache.artifacts, artifact];
        this._write(this.artifactsFile, 'artifacts', artifacts);
        return artifact;
    }
}

module.exports = DataService;
