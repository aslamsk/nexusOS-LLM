"use client";

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
  X,
  PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';

export default function Dashboard() {
    const [projects, setProjects] = useState<any[]>([]);
    const [allTasks, setAllTasks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [goal, setGoal] = useState('');
    const [isOrchestrating, setIsOrchestrating] = useState(false);
    
    // Mission Control State
    const [nexusLogs, setNexusLogs] = useState<any[]>([]);
    const [activeAgents, setActiveAgents] = useState<Record<string, string>>({});

    const fetchAll = async () => {
        try {
            const pRes = await fetch('http://localhost:3000/api/projects');
            const pData = await pRes.json();
            setProjects(pData);
            
            // Fetch tasks for ALL projects
            const allTasksResponse = await Promise.all(pData.map((p: any) => 
                fetch(`http://localhost:3000/api/tasks/${p.id}`).then(res => res.json())
            ));
            const flatTasks = allTasksResponse.flat();
            setAllTasks(flatTasks);
            
            setIsLoading(false);
        } catch (e) {
            console.error("Dashboard Sync Error:", e);
        }
    };

    useEffect(() => {
        fetchAll();
        const interval = setInterval(fetchAll, 3000);

        // Professional Socket.io Connection
        const socket = io('http://localhost:3000', {
            reconnectionAttempts: 5,
            timeout: 10000,
        });

        socket.on('connect', () => {
            console.log('Mission Control Connected');
        });

        socket.on('nexus_log', (log) => {
            setNexusLogs(prev => [log, ...prev].slice(0, 50));
            if (log.agentId) {
                setActiveAgents(prev => ({
                    ...prev,
                    [log.agentId]: log.status || 'active'
                }));
            }
        });

        socket.on('nexus-update', (update) => {
            fetchAll();
        });

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, []);

    const handleCreateProject = async (e: React.FormEvent) => {
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
                fetchAll();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsOrchestrating(false);
        }
    };

    const handleApproveTask = async (taskId: string) => {
        try {
            const res = await fetch(`http://localhost:3000/api/tasks/${taskId}/approve`, {
                method: 'POST'
            });
            if (res.ok) fetchAll();
        } catch (err) {
            console.error("Approval Error:", err);
        }
    };

    const handleDeleteProject = async (projectId: string, projectName: string) => {
        if (!confirm(`Boss, are you sure you want to decommission project "${projectName}"? This will delete all associated tasks and artifacts.`)) return;
        try {
            const res = await fetch(`http://localhost:3000/api/projects/${projectId}`, {
                method: 'DELETE'
            });
            if (res.ok) fetchAll();
        } catch (err) {
            console.error("Deletion Error:", err);
        }
    };

    return (
        <div className="flex h-screen bg-jarvis-bg text-white overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-[280px] border-r border-panel-border bg-black/40 backdrop-blur-3xl p-6 flex flex-col z-50">
                <div className="flex items-center gap-3 mb-10 px-2">
                    <img src="/logo.png" alt="Nexus" className="w-8 h-8 object-contain" />
                    <h2 className="text-xl font-bold tracking-tight font-outfit">Nexus OS</h2>
                </div>

                <nav className="flex-1 space-y-4">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4 px-3">System</p>
                        <NavItem icon={<LayoutDashboard size={18}/>} label="Dashboard" active />
                        <NavItem icon={<ExternalLink size={18}/>} label="Agents roster" />
                        <NavItem icon={<Settings size={18}/>} label="Settings" />
                    </div>

                    <div className="pt-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4 px-3">Active Agents</p>
                        <div className="space-y-2 px-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {Array.from(new Set([...allTasks.map(t => t.role), ...Object.keys(activeAgents)])).filter(Boolean).map(role => (
                                <div key={role} className="flex items-center justify-between group">
                                    <span className="text-sm text-zinc-400 group-hover:text-white transition cursor-default capitalize">{role.replace('_', ' ')}</span>
                                    <div className={`w-2 h-2 rounded-full transition-all duration-500 ${activeAgents[role] === 'thinking' ? 'bg-amber-400 animate-pulse shadow-[0_0_12px_rgba(251,191,36,0.8)] scale-125' : activeAgents[role] === 'working' ? 'bg-indigo-400 animate-pulse shadow-[0_0_12px_rgba(129,140,248,0.8)] scale-125' : 'bg-zinc-800'}`} />
                                </div>
                            ))}
                            {allTasks.length === 0 && Object.keys(activeAgents).length === 0 && (
                                <p className="text-[10px] text-zinc-600 px-3 italic">Awaiting deployment...</p>
                            )}
                        </div>
                    </div>
                </nav>

                <div className="mt-auto px-2">
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
                            BOSS
                        </div>
                        <div className="text-[11px]">
                            <p className="font-bold">boss@nexus.os</p>
                            <p className="text-zinc-500">Executive Director</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-10 mt-2 custom-scrollbar">
                <header className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-3xl text-gradient mb-1 font-outfit">Boss Dashboard</h1>
                        <p className="text-zinc-500 text-sm">Reviewing Nexus HQ operations & hierarchical approvals.</p>
                    </div>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <PlusCircle size={20} />
                        New Mission
                    </button>
                </header>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                        <Loader2 className="animate-spin mb-4" size={32} />
                        <p>Synchronizing HQ...</p>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="glass-panel p-20 text-center max-w-2xl mx-auto mt-10">
                        <div className="text-5xl mb-6">🏢</div>
                        <h3 className="text-2xl mb-3 font-outfit">Hiring Managed Agents...</h3>
                        <p className="text-zinc-500 mb-8 max-w-sm mx-auto">
                            Issue a mission directive to your Project Manager to begin the hierarchical work split.
                        </p>
                        <button 
                            onClick={() => setIsModalOpen(true)}
                            className="btn-primary"
                        >
                            Open Nexus HQ
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                        <div className="xl:col-span-2 space-y-12">
                            {/* Projects Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {projects.map(project => (
                                    <motion.div 
                                        key={project.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="glass-panel p-6 flex flex-col h-full group"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="text-lg font-bold font-outfit">{project.name}</h3>
                                            <div className="flex items-center gap-2">
                                                <StatusBadge status={project.status} />
                                                <button 
                                                    onClick={() => handleDeleteProject(project.id, project.name)}
                                                    className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-zinc-400 text-sm mb-6 flex-1 leading-relaxed italic">
                                            "{project.description}"
                                        </p>
                                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                            <span className="text-[11px] text-zinc-500 uppercase tracking-widest font-bold">
                                                Direct Instruction • {new Date(project.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Recent Activity / Tasks */}
                            <div className="space-y-6">
                                <h2 className="text-xl font-bold font-outfit">Hierarchical Task Pipeline</h2>
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                                    <TaskColumn title="In Progress" color="amber" tasks={allTasks.filter(t => t.status === 'running' || t.status === 'pending')} />
                                    <TaskColumn title="Completed" color="emerald" tasks={allTasks.filter(t => t.status === 'completed')} />
                                    <TaskColumn 
                                        title="Approvals Required" 
                                        color="indigo" 
                                        tasks={allTasks.filter(t => t.status === 'waiting_approval')} 
                                        onApprove={handleApproveTask}
                                    />
                                    <TaskColumn title="Awaiting" color="zinc" tasks={allTasks.filter(t => !['running', 'pending', 'completed', 'waiting_approval'].includes(t.status))} />
                                </div>
                            </div>
                        </div>

                        {/* Mission Control Sidebar */}
                        <aside className="space-y-6">
                            <h2 className="text-xl font-bold font-outfit">HQ Telemetry</h2>
                            <div className="glass-panel bg-black/20 p-5 h-[calc(100vh-280px)] border-panel-border flex flex-col">
                                <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                                    {nexusLogs.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4 opacity-50">
                                            <Loader2 size={32} />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Manager reports...</p>
                                        </div>
                                    ) : (
                                        nexusLogs.map((log, i) => (
                                            <div key={i} className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[9px] font-black uppercase tracking-widest ${log.agentId ? 'text-indigo-400' : 'text-zinc-500'}`}>
                                                        {log.agentId || 'System'} • {log.status || 'LOG'}
                                                    </span>
                                                    <span className="text-[9px] text-zinc-600 tabular-nums">
                                                        {new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] font-medium leading-relaxed text-zinc-400 bg-white/[0.01] p-2 rounded border border-white/[0.02]">
                                                    {log.message}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </aside>
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
                            <h2 className="text-2xl font-bold mb-2 font-outfit">Directive for Project Manager</h2>
                            <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                                Outline your business goal. The Project Manager will break it down into specialized subtasks for the Architect and Developers and wait for your approvals.
                            </p>

                            <form onSubmit={handleCreateProject} className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest px-1">Goal / Client Request</label>
                                    <textarea 
                                        autoFocus
                                        rows={4}
                                        className="w-full bg-black/40 border border-panel-border rounded-xl p-4 text-white focus:outline-none focus:border-accent-primary transition shadow-inner custom-scrollbar"
                                        placeholder="e.g. Build an AI-driven marketing dashboard with n8n integrations..."
                                        value={goal}
                                        onChange={(e) => setGoal(e.target.value)}
                                    />
                                </div>
                                <div className="flex justify-end gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-2.5 text-zinc-400 font-bold hover:text-white transition uppercase tracking-widest text-[11px]"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={!goal || isOrchestrating}
                                        className="btn-primary uppercase tracking-widest text-[11px]"
                                    >
                                        {isOrchestrating ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="animate-spin" size={18} />
                                                <span>PM Planning...</span>
                                            </div>
                                        ) : 'Issue Directive'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

const NavItem = ({ icon, label, active }: any) => (
    <div className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${active ? 'bg-white/5 text-white border border-white/5 font-bold shadow-lg' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}>
        {icon}
        <span className="text-sm tracking-tight">{label}</span>
    </div>
);

const StatusBadge = ({ status }: any) => {
    const colors: any = {
        planning: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
        active: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        failed: 'bg-red-500/10 text-red-100 border-red-500/20',
        waiting_approval: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    };
    const colorClass = colors[status] || colors.planning;
    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${colorClass}`}>
            {status?.replace('_', ' ') || 'planning'}
        </span>
    );
};

const TaskColumn = ({ title, tasks, color, onApprove }: any) => {
    const bgColors: any = {
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
                {tasks.map((task: any) => (
                    <div key={task.id} className="bg-black/30 border border-white/5 p-3 rounded-xl hover:border-white/10 transition-all group">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold line-clamp-2 leading-tight flex-1">{task.title}</p>
                            {onApprove && (
                                <button 
                                    onClick={() => onApprove(task.id)}
                                    className="ml-2 text-[9px] bg-indigo-500 hover:bg-indigo-400 text-white font-black px-2 py-1 rounded transition-all transform group-hover:scale-105"
                                >
                                    APPROVE
                                </button>
                            )}
                        </div>
                        <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">{task.role || 'Unassigned'}</p>
                    </div>
                ))}
                {tasks.length === 0 && (
                    <div className="h-full flex items-center justify-center text-[10px] text-zinc-700 italic font-bold uppercase tracking-widest">
                        Pipeline Clean
                    </div>
                )}
            </div>
        </div>
    );
};
