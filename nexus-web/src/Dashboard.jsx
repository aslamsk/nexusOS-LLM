import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  Plus, 
  Trash2, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Dashboard = () => {
    const [projects, setProjects] = useState([]);
    const [allTasks, setAllTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [goal, setGoal] = useState('');
    const [isOrchestrating, setIsOrchestrating] = useState(false);

    const fetchAll = async () => {
        try {
            const pRes = await fetch('http://localhost:3000/api/projects');
            const pData = await pRes.json();
            setProjects(pData);
            
            // For a "Global Task Board", we fetch all projects' tasks
            // But for simplicity in the demo, let's just fetch for the latest project if exists
            if (pData.length > 0) {
                const tRes = await fetch(`http://localhost:3000/api/tasks/${pData[0].id}`);
                const tData = await tRes.json();
                setAllTasks(tData);
            }
            setIsLoading(false);
        } catch (e) {
            console.error("Dashboard Sync Error:", e);
        }
    };

    const handleCreateProject = async (e) => {
        e.preventDefault();
        if (!goal) return;
        setIsOrchestrating(true);
        try {
            const res = await fetch('http://localhost:3000/api/orchestrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal })
            });
            const data = await res.json();
            if (data.success) {
                setIsModalOpen(false);
                setGoal('');
                fetchAll(); // Refresh list
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsOrchestrating(false);
        }
    };

    useEffect(() => {
        fetchAll();
        const interval = setInterval(fetchAll, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex h-screen bg-jarvis-bg text-white overflow-hidden">
            {/* Sidebar */}
            <aside className="w-[260px] border-r border-jarvis-border bg-black/40 backdrop-blur-3xl p-6 flex flex-col z-50">
                <div className="flex items-center gap-3 mb-10 px-2">
                    <img src="/logo.png" alt="Nexus" className="w-8 h-8 object-contain" />
                    <h2 className="text-xl font-bold tracking-tight">Nexus OS</h2>
                </div>

                <nav className="flex-1 space-y-1">
                    <NavItem icon={<LayoutDashboard size={18}/>} label="Dashboard" active />
                    <NavItem icon={<ExternalLink size={18}/>} label="Agents" />
                    <NavItem icon={<Settings size={18}/>} label="Settings" />
                </nav>

                <div className="mt-auto px-2">
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
                            AS
                        </div>
                        <div className="text-[11px]">
                            <p className="font-bold">admin@nexus.os</p>
                            <p className="text-zinc-500">Super Admin</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-10 mt-2">
                <header className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-3xl text-gradient mb-1">Command Center</h1>
                        <p className="text-zinc-500 text-sm">Overview of your autonomous AI ecosystem.</p>
                    </div>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus size={20} />
                        New Orchestration
                    </button>
                </header>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                        <Loader2 className="animate-spin mb-4" size={32} />
                        <p>Loading Workspace...</p>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="glass-panel p-20 text-center max-w-2xl mx-auto mt-10">
                        <div className="text-5xl mb-6">🚀</div>
                        <h3 className="text-2xl mb-3">Workspace is Empty</h3>
                        <p className="text-zinc-500 mb-8">
                            Ready to automate your business? Describe your goal to Nexus and watch the orchestration begin.
                        </p>
                        <button 
                            onClick={() => setIsModalOpen(true)}
                            className="btn-primary"
                        >
                            Start Your First Project
                        </button>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Projects Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {projects.map(project => (
                                <motion.div 
                                    key={project.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="glass-panel p-6 flex flex-col h-full"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-bold">{project.name}</h3>
                                        <StatusBadge status={project.status} />
                                    </div>
                                    <p className="text-zinc-400 text-sm mb-6 flex-1 leading-relaxed">
                                        {project.description}
                                    </p>
                                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                        <span className="text-[11px] text-zinc-500">Created {new Date(project.createdAt).toLocaleDateString()}</span>
                                        <a href="#" className="text-indigo-400 text-xs font-bold hover:underline">View Workspace →</a>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Recent Activity / Tasks */}
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold">Global Task Board</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                                <TaskColumn title="In Progress" color="amber" tasks={allTasks.filter(t => t.status === 'running')} />
                                <TaskColumn title="Completed" color="emerald" tasks={allTasks.filter(t => t.status === 'completed')} />
                                <TaskColumn title="Approvals" color="indigo" tasks={allTasks.filter(t => t.status === 'waiting_approval')} />
                                <TaskColumn title="Others" color="zinc" tasks={allTasks.filter(t => !['running', 'completed', 'waiting_approval'].includes(t.status))} />
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Orchestration Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="glass-panel w-full max-w-xl p-10 relative"
                        >
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="absolute top-6 right-6 text-zinc-500 hover:text-white transition"
                            >
                                <X size={24} />
                            </button>
                            <h2 className="text-2xl font-bold mb-2">New Orchestration Goal</h2>
                            <p className="text-zinc-500 text-sm mb-8">
                                Describe what you want to build or achieve. Nexus Orchestrator will automatically break this down into a project plan and assign AI agents to tasks.
                            </p>

                            <form onSubmit={handleCreateProject} className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-zinc-400">What is your goal?</label>
                                    <textarea 
                                        autoFocus
                                        rows={4}
                                        className="w-full bg-black/40 border border-jarvis-border rounded-xl p-4 text-white focus:outline-none focus:border-jarvis-primary transition shadow-inner"
                                        placeholder="e.g. Build a comprehensive market research report on Next.js adoption in 2026..."
                                        value={goal}
                                        onChange={(e) => setGoal(e.target.value)}
                                    />
                                </div>
                                <div className="flex justify-end gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-2.5 text-zinc-400 font-bold hover:text-white transition"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={!goal || isOrchestrating}
                                        className="btn-primary"
                                    >
                                        {isOrchestrating ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="animate-spin" size={18} />
                                                <span>Orchestrating...</span>
                                            </div>
                                        ) : 'Generate Plan'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const NavItem = ({ icon, label, active }) => (
    <div className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${active ? 'bg-white/5 text-white border border-white/5 font-bold' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}>
        {icon}
        <span className="text-sm tracking-tight">{label}</span>
    </div>
);

const StatusBadge = ({ status }) => {
    const colors = {
        planning: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
        active: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        failed: 'bg-red-500/10 text-red-100 border-red-500/20'
    };
    const colorClass = colors[status] || colors.planning;
    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${colorClass}`}>
            {status || 'planning'}
        </span>
    );
};

const TaskColumn = ({ title, tasks, color }) => {
    const bgColors = {
        amber: 'bg-amber-500/20 text-amber-500',
        emerald: 'bg-emerald-500/20 text-emerald-500',
        indigo: 'bg-indigo-500/20 text-indigo-500',
        zinc: 'bg-zinc-500/20 text-zinc-500'
    };
    return (
        <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5 flex flex-col h-[320px]">
            <div className="flex justify-between items-center mb-4 px-2">
                <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">{title}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${bgColors[color]}`}>{tasks.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {tasks.map(task => (
                    <div key={task.id} className="bg-black/30 border border-white/5 p-3 rounded-xl">
                        <p className="text-sm font-bold mb-1 line-clamp-2">{task.title}</p>
                        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">{task.role}</p>
                    </div>
                ))}
                {tasks.length === 0 && (
                    <div className="h-full flex items-center justify-center text-[10px] text-zinc-700 italic font-bold uppercase tracking-widest">
                        Clean Slate
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
