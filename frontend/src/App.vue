<script setup>
import { ref, reactive, onMounted, nextTick, watch, computed } from 'vue'
import { io } from 'socket.io-client'

const socket = io()

// ─── Navigation & Core ───────────────────
const activeView = ref('chat')
const isMobile = ref(window.innerWidth < 768)
const handleResize = () => isMobile.value = window.innerWidth < 768
onMounted(() => window.addEventListener('resize', handleResize))

const chatHistory = ref([{ sender: 'nexus', text: 'Nexus OS is fully operational. Protocol Obsidian Ethereal active. What is your objective, Boss?' }])
const sessionId = ref(localStorage.getItem('nexus_session_id'))

let syncTimeout = null;
watch([chatHistory], () => {
  if (sessionId.value) {
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => socket.emit('sync_history', { history: JSON.parse(JSON.stringify(chatHistory.value)) }), 1000);
  }
}, { deep: true })

const promptInput = ref('')
const isWorking = ref(false)

// ─── CRM & Tools Data ────────────────────
const clients = ref([])
const toolsData = ref([])
const isLoadingCRM = ref(false)

const navItems = [
  { view: 'chat', label: 'Mission Control', icon: '⚡' },
  { view: 'clients', label: 'Client Nexus', icon: '👥' },
  { view: 'tools', label: 'Tools Matrix', icon: '🛠️' },
  { view: 'settings', label: 'Settings', icon: '⚙️' }
]

const currentViewTitle = computed(() => navItems.find(i => i.view === activeView.value)?.label || 'Dashboard')

// ─── Settings & Quotas ───────────────────
const configEntries = ref([])
const configEdits = ref({})
const revealKeys = ref({})
const configToast = ref({ show: false, message: '', type: 'success' })

const openSettings = async () => {
  activeView.value = 'settings'
  try {
    const res = await fetch('/api/config')
    const data = await res.json()
    configEntries.value = data.configs || []
    
    const edits = {}
    const reveals = {}
    for (const entry of configEntries.value) {
      edits[entry.key] = entry.isSet ? entry.value : ''
      reveals[entry.key] = false
      if (entry.key === 'QUOTA_MODE' && !edits[entry.key]) edits[entry.key] = 'FREE'
    }
    configEdits.value = edits
    revealKeys.value = reveals
  } catch (e) {}
}

const saveConfig = async () => {
  try {
    const updates = {}
    for (const [k, v] of Object.entries(configEdits.value)) if (v !== '') updates[k] = v
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    })
    if (res.ok) showToast('System Protocol Updated', 'success')
  } catch (e) {}
}

const showToast = (message, type) => {
  configToast.value = { show: true, message, type }
  setTimeout(() => configToast.value.show = false, 3000)
}

// ─── Client Nexus & Client Keys ──────────
const isAddingClient = ref(false)
const newClient = ref({ name: '', company: '' })

const isManagingClientKeys = ref(false)
const activeClient = ref(null)
const clientKeysList = ref([])
const clientKeyEdits = ref({})

const loadClients = async () => {
  isLoadingCRM.value = true
  try {
    const res = await fetch('/api/clients')
    const data = await res.json()
    clients.value = data.clients || []
  } catch (e) {
    showToast('CRM Sync Failed', 'error')
  } finally {
    isLoadingCRM.value = false
  }
}

const saveClient = async () => {
  if (!newClient.value.name) return showToast('Entity Name required', 'error')
  try {
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newClient.value)
    })
    if (res.ok) {
      showToast('Client Entity Registered', 'success')
      isAddingClient.value = false
      newClient.value = { name: '', company: '' }
      loadClients()
    } else {
      showToast('Registration Error', 'error')
    }
  } catch (e) { showToast('Registration Error', 'error') }
}

const manageClientKeys = async (client) => {
  activeClient.value = client
  try {
    const res = await fetch(`/api/clients/${client.id}/keys`)
    const data = await res.json()
    clientKeysList.value = data.keys || []
    
    const edits = {}
    for (const k of clientKeysList.value) {
      edits[k.key] = k.isSet ? k.value : ''
    }
    clientKeyEdits.value = edits
  } catch(e) {}
  isManagingClientKeys.value = true
}

const saveClientKeys = async () => {
  try {
    const updates = {}
    for (const [k, v] of Object.entries(clientKeyEdits.value)) if (v !== '') updates[k] = v
    const res = await fetch(`/api/clients/${activeClient.value.id}/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    })
    if(res.ok) {
      showToast('Isolated Client Keys Secured', 'success')
      isManagingClientKeys.value = false
    } else {
      showToast('Error saving keys', 'error')
    }
  } catch(e){
    showToast('Error saving keys', 'error')
  }
}

// ─── Tools Matrix Edit Logic ──────────────
const loadToolsDashboard = async () => {
  try {
    const res = await fetch('/api/system-status')
    const data = await res.json()
    toolsData.value = data.integrations || []
  } catch (e) {}
}

const isEditingTool = ref(false)
const activeTool = ref(null)

const editTool = async (tool) => {
  activeTool.value = tool
  try {
    const res = await fetch('/api/config')
    const data = await res.json()
    const rulesKey = 'TOOL_' + tool.id.toUpperCase() + '_RULES'
    const existing = (data.configs || []).find(c => c.key === rulesKey)
    if(existing && existing.isSet) {
      configEdits.value[rulesKey] = existing.value
    } else if(!configEdits.value[rulesKey]) {
      configEdits.value[rulesKey] = ''
    }
  } catch (e) {}
  isEditingTool.value = true
}

const updateToolConfig = async () => {
    await saveConfig()
    isEditingTool.value = false
    showToast(`${activeTool.value.name} Guidelines Updated`, 'success')
}

const testTool = (tool) => {
    isEditingTool.value = false
    activeView.value = 'chat'
    promptInput.value = `Test the ${tool.name} capability. Run a diagnostic and provide output.`
    submitTask()
}

// ─── Mission Control Logic ───────────────
const selectedClientForChat = ref('')

onMounted(() => {
  socket.on('nexus_log', (data) => {
    if (data.type === 'thought' || data.type === 'action') {
      const last = chatHistory.value[chatHistory.value.length - 1]
      if (last.sender === 'nexus_thought') last.text = data.message || `Protocol: ${data.name}`
      else chatHistory.value.push({ sender: 'nexus_thought', text: data.message || `Protocol: ${data.name}` })
    } else if (data.type === 'complete') {
      chatHistory.value.push({ sender: 'nexus', text: 'Objective achieved, Boss.' })
      isWorking.value = false
    }
    scrollToBottom()
  })
  
  loadClients()
})

const chatContainer = ref(null)
const scrollToBottom = async () => {
  await nextTick()
  if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight
}

const formatMessage = (t) => t ? t.replace(/\n/g, '<br>') : ''

const submitTask = () => {
  const p = promptInput.value.trim()
  if (!p || isWorking.value) return
  
  let prefix = selectedClientForChat.value ? `[Context: Client ${clients.value.find(c=>c.id === selectedClientForChat.value)?.name}] ` : ''
  chatHistory.value.push({ sender: 'user', text: prefix + p })
  
  promptInput.value = ''
  isWorking.value = true
  socket.emit('start_task', { prompt: p, clientId: selectedClientForChat.value || null })
  scrollToBottom()
}
</script>

<template>
  <div class="app-container obsidian-ethereal">
    
    <!-- Ethereal Sidebar -->
    <aside class="sidebar-hud">
      <div class="sidebar-head">
        <div class="logo-wrap">
          <div class="logo-inner">N</div>
          <span class="logo-txt">NexusOS</span>
        </div>
      </div>

      <nav class="nav-stack">
        <button 
          v-for="item in navItems" 
          :key="item.view"
          class="nav-tab"
          :class="{ active: activeView === item.view }"
          @click="activeView = item.view; if(item.view === 'clients') loadClients(); if(item.view === 'tools') loadToolsDashboard(); if(item.view === 'settings') openSettings()"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </button>
      </nav>

      <div class="sidebar-foot">
        <div class="profile-chip">
          <div class="chip-avatar">AD</div>
          <div class="chip-info">
            <span class="u-name">Administrator</span>
            <span class="u-status"><i class="pulse-dot"></i> Online</span>
          </div>
        </div>
      </div>
    </aside>

    <main class="main-viewport">
      <div class="ethereal-glow"></div>
      
      <!-- Top Breadcrumb Bridge -->
      <header class="view-header-bridge">
        <div class="bridge-left">
          <span class="b-root">Dashboard</span>
          <span class="b-sep">/</span>
          <span class="b-cur">{{ currentViewTitle }}</span>
        </div>
        <div class="bridge-right">
          <span class="b-admin">admin@nexus.os</span>
          <div class="telemetry-box" v-if="activeView === 'chat'">
            <span class="t-label">SESSION</span>
            <span class="t-val">ACTIVE</span>
          </div>
          <button v-if="activeView === 'clients'" class="action-btn-pro" @click="isAddingClient = true">+ New Client Entity</button>
          <button v-else class="action-btn-pro" @click="activeView = 'chat'">+ New Orchestration</button>
        </div>
      </header>

      <div class="viewport-canvas">
        <transition name="portal-fade" mode="out-in">
          <div :key="activeView" class="portal-root">
            
            <!-- Headings -->
            <div class="portal-intro">
              <h1>{{ currentViewTitle }}</h1>
              <p class="intro-sub">Normal Text Architecture</p>
              
              <!-- Top-Right Metric HUD -->
              <div class="metric-hud" v-if="activeView === 'clients'">
                <span class="m-val">{{ clients.length }}</span>
                <span class="m-label">Entities</span>
              </div>
              <div class="metric-hud" v-else-if="activeView === 'tools'">
                <span class="m-val">{{ toolsData.length }}</span>
                <span class="m-label">Capabilities</span>
              </div>
            </div>

            <!-- Ethereal Portals (Grids) -->
            <div v-if="activeView === 'clients' || activeView === 'tools'" class="ethereal-grid">
              
              <!-- List iteration logic -->
              <div v-for="(item, idx) in (activeView === 'clients' ? clients : toolsData)" :key="item.id" class="ethereal-card">
                <div class="e-card-head">
                  <h3>{{ item.name }}</h3>
                  <div class="capsule-stack">
                    <div class="capsule idle">{{ activeView === 'clients' ? 'Idle' : (item.status === 'active' ? 'Active' : 'Offline') }}</div>
                    
                    <button v-if="activeView === 'tools'" class="capsule edit" @click="editTool(item)">Configure</button>
                    <!-- Client Keys Config Button -->
                    <button v-else class="capsule edit" @click="manageClientKeys(item)">Keys</button>
                  </div>
                </div>
                
                <div class="e-card-body">
                  <p>{{ activeView === 'clients' ? item.email : item.description }}</p>
                  <p v-if="activeView === 'clients'" class="e-subtxt">{{ item.company }}</p>
                </div>
                
                <div class="e-card-foot">
                  <span class="e-date">Updated Recently</span>
                  <button v-if="activeView === 'clients'" @click="activeView = 'chat'; selectedClientForChat = item.id" class="e-link-btn">Init Mission Context →</button>
                  <a v-else href="#" class="e-link" @click.prevent="testTool(item)">Run Test Diagnostic →</a>
                </div>
              </div>

            </div>

            <!-- Mission Control (Ethereal Chat) -->
            <div v-if="activeView === 'chat'" class="ethereal-chat-portal">
              
              <div class="context-toolbar" v-if="clients.length > 0">
                <span class="ctx-label">Execution Context:</span>
                <select v-model="selectedClientForChat" class="pro-ctx-select">
                  <option value="">System Default</option>
                  <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>

              <div class="chat-viewport-pro" ref="chatContainer">
                <div class="chat-stream-pro">
                  <div v-for="(msg, idx) in chatHistory" :key="idx" class="pro-msg-row" :class="msg.sender">
                    <div class="pro-bubble" :class="msg.sender">
                      <div class="pro-meta">{{ msg.sender.startsWith('nexus') ? 'NEXUS.OS' : 'COMMAND' }}</div>
                      <div class="pro-text" v-html="formatMessage(msg.text)"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="input-bridge-pro">
                <div class="bridge-inner">
                  <textarea v-model="promptInput" @keydown.enter.prevent="submitTask" placeholder="Enter high-level objective..."></textarea>
                  <button class="pro-fire-btn" @click="submitTask" :disabled="isWorking">
                    <span>🚀</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Settings (Ethereal Style) -->
            <div v-if="activeView === 'settings'" class="settings-ethereal-wrap">
              <div class="settings-card-pro">
                <div v-for="e in configEntries" :key="e.key" class="pro-field">
                  
                  <template v-if="e.key === 'QUOTA_MODE'">
                    <label>System Performance Tier</label>
                    <div class="quota-group">
                      <label class="q-opt" :class="{active: configEdits[e.key] === 'FREE'}">
                        <input type="radio" value="FREE" v-model="configEdits[e.key]"> Free (Throttled)
                      </label>
                      <label class="q-opt" :class="{active: configEdits[e.key] === 'NORMAL'}">
                        <input type="radio" value="NORMAL" v-model="configEdits[e.key]"> Normal (Standard)
                      </label>
                      <label class="q-opt" :class="{active: configEdits[e.key] === 'HIGH'}">
                        <input type="radio" value="HIGH" v-model="configEdits[e.key]"> High (Premium Tier)
                      </label>
                    </div>
                  </template>

                  <template v-else>
                    <label>{{ e.label }}</label>
                    <div class="pro-input-wrap">
                      <input :type="revealKeys[e.key] ? 'text' : 'password'" v-model="configEdits[e.key]" :placeholder="e.isSet ? '•••••••• (Configured)' : 'Unconfigured'">
                      <button class="eye-toggle" @click.prevent="revealKeys[e.key] = !revealKeys[e.key]" title="Toggle Visibility">
                        {{ revealKeys[e.key] ? '🙈' : '👁️' }}
                      </button>
                    </div>
                  </template>

                </div>
                <button class="pro-save-btn" @click="saveConfig">Apply System Protocol</button>
              </div>
            </div>

          </div>
        </transition>
      </div>
    </main>

    <!-- Add Client Ethereal Modal -->
    <transition name="modal-fade">
      <div v-if="isAddingClient" class="ethereal-modal-overlay" @click.self="isAddingClient = false">
        <div class="ethereal-modal-content">
          <h3>Register Client Entity</h3>
          <p class="m-sub">Initialize a new isolated operational context.</p>
          
          <div class="m-field">
            <label>Entity Name</label>
            <input v-model="newClient.name" placeholder="e.g. Acme Corp" class="pro-input">
          </div>
          <div class="m-field">
            <label>Organization</label>
            <input v-model="newClient.company" placeholder="e.g. Acme Enterprises" class="pro-input">
          </div>
          
          <div class="modal-actions">
            <button class="capsule edit" @click="isAddingClient = false">Abort</button>
            <button class="capsule idle fill" @click="saveClient">Register Entity</button>
          </div>
        </div>
      </div>
    </transition>
    
    <!-- Client API Keys Modal -->
    <transition name="modal-fade">
      <div v-if="isManagingClientKeys && activeClient" class="ethereal-modal-overlay" @click.self="isManagingClientKeys = false">
        <div class="ethereal-modal-content keys-modal">
          <h3>Isolated Keys: {{ activeClient.name }}</h3>
          <p class="m-sub">Configure dedicated API connections (Gemini, Meta, Brave, etc.) to isolate billing and margins per client.</p>
          
          <div class="scroll-keys">
             <div v-for="k in clientKeysList" :key="k.key" class="m-field-compact">
                <label>{{ k.label }}</label>
                <input type="password" v-model="clientKeyEdits[k.key]" :placeholder="k.isSet ? '•••••••• (Linked)' : 'Unconfigured'" class="pro-input compact-input">
             </div>
          </div>
          
          <div class="modal-actions">
            <button class="capsule edit" @click="isManagingClientKeys = false">Close</button>
            <button class="capsule idle fill" @click="saveClientKeys">Save Keys</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Configure Tool Ethereal Modal -->
    <transition name="modal-fade">
      <div v-if="isEditingTool && activeTool" class="ethereal-modal-overlay" @click.self="isEditingTool = false">
        <div class="ethereal-modal-content">
          <h3>Configure Capability: {{ activeTool.name }}</h3>
          <p class="m-sub">{{ activeTool.description }}</p>
          
          <div class="m-field">
            <label>Provider Setup Status</label>
            <div>
              <span class="status-indicator-pro" :class="activeTool.status">
                {{ activeTool.status === 'active' ? 'Operational' : 'Missing Credentials' }}
              </span>
            </div>
            <p class="guide-txt">{{ activeTool.howToGet }} • Setup via {{ activeTool.addVia }}</p>
          </div>

          <div class="m-field">
            <label>Custom Instructions / Operational Rules</label>
            <textarea v-model="configEdits['TOOL_' + activeTool.id.toUpperCase() + '_RULES']" placeholder="e.g., Always format output strictly as JSON..." class="pro-textarea"></textarea>
          </div>
          
          <div class="modal-actions">
            <button class="capsule edit" @click="testTool(activeTool)">Initiate Diagnostic Test</button>
            <button class="capsule idle fill" @click="updateToolConfig">Deploy Configuration</button>
          </div>
        </div>
      </div>
    </transition>

  </div>

  <div v-if="configToast.show" class="ethereal-toast" :class="configToast.type">
    {{ configToast.message }}
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@800;900&display=swap');

:root {
  /* Obsidian Ethereal Palette */
  --eth-bg: #0d1117;
  --eth-sidebar: #010409;
  --eth-glass: rgba(13, 17, 23, 0.4);
  --eth-border: rgba(99, 102, 241, 0.12);
  --eth-glow: #221545;
  
  --p-midnight: #2c3e50;
  --p-indigo: #6366f1;
  --p-carrot: #f39c12;
  --p-red: #e74c3c;
  
  --text-pure: #ffffff;
  --text-dim: #94a3b8;
  --text-muted: #484f58;
  
  --sidebar-w: 240px;
  --header-h: 60px;
  --glass-blur: blur(50px) saturate(240%);
  --anim-fluid: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Inter', sans-serif;
  background-color: var(--eth-bg);
  color: var(--text-pure);
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

.app-container { display: flex; height: 100vh; width: 100vw; }

.sidebar-hud { width: var(--sidebar-w); background: var(--eth-sidebar); border-right: 1px solid var(--eth-border); display: flex; flex-direction: column; z-index: 1000; }
.sidebar-head { height: var(--header-h); padding: 0 1.5rem; display: flex; align-items: center; }
.logo-wrap { display: flex; align-items: center; gap: 0.85rem; }
.logo-inner { width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, var(--p-indigo), var(--p-red)); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.9rem; font-family: 'Outfit', sans-serif; }
.logo-txt { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 1.25rem; }
.nav-stack { flex: 1; padding: 1.5rem 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; }
.nav-tab { background: transparent; border: none; padding: 0.85rem 1rem; border-radius: 8px; color: var(--text-dim); cursor: pointer; display: flex; align-items: center; gap: 1rem; font-weight: 600; font-size: 0.9rem; transition: var(--anim-fluid); }
.nav-tab:hover { background: rgba(255,255,255,0.02); color: white; }
.nav-tab.active { background: rgba(99, 102, 241, 0.08); color: white; }
.sidebar-foot { padding: 1.25rem; border-top: 1px solid var(--eth-border); }
.profile-chip { display: flex; align-items: center; gap: 0.85rem; }
.chip-avatar { width: 34px; height: 34px; border-radius: 50%; background: #1f2937; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 850; color: var(--p-indigo); border: 1px solid rgba(99,102,241,0.2); }
.u-name { display: block; font-size: 0.85rem; font-weight: 750; }
.u-status { font-size: 0.7rem; color: #10b981; font-weight: 600; display: flex; align-items: center; gap: 0.35rem; }
.pulse-dot { width: 5px; height: 5px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; }

.main-viewport { flex: 1; display: flex; flex-direction: column; background: var(--eth-bg); position: relative; overflow: hidden; }
.ethereal-glow { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle at 12% 12%, var(--eth-glow) 0%, transparent 60%); opacity: 0.45; pointer-events: none; z-index: 1; }

.view-header-bridge { height: var(--header-h); padding: 0 2.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--eth-border); z-index: 10; }
.bridge-left { display: flex; gap: 0.75rem; font-size: 0.85rem; color: var(--text-dim); font-weight: 600; }
.b-cur { color: white; }
.bridge-right { display: flex; align-items: center; gap: 1.5rem; }
.b-admin { font-size: 0.8rem; color: var(--text-muted); font-weight: 600; }
.telemetry-box { display: flex; align-items: center; gap: 0.5rem; background: rgba(16, 185, 129, 0.05); padding: 0.35rem 0.75rem; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.15); }
.t-label { font-size: 0.65rem; font-weight: 900; color: #10b981; opacity: 0.6; }
.t-val { font-size: 0.7rem; font-weight: 900; color: #10b981; }

.action-btn-pro { background: var(--p-indigo); color: white; border: none; padding: 0.6rem 1.25rem; border-radius: 8px; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: 0.3s; box-shadow: 0 8px 20px rgba(99, 102, 241, 0.2); }
.action-btn-pro:hover { transform: translateY(-2px); box-shadow: 0 12px 25px rgba(99, 102, 241, 0.3); }

.viewport-canvas { flex: 1; overflow-y: auto; padding: 3rem 4rem; z-index: 5; position: relative; }
.portal-intro { margin-bottom: 3rem; position: relative; }
.portal-intro h1 { font-family: 'Outfit', sans-serif; font-size: 2.2rem; font-weight: 900; margin-bottom: 0.5rem; letter-spacing: -1px; }
.intro-sub { font-size: 1rem; color: var(--text-dim); }

.metric-hud { position: absolute; right: 0; top: 0; background: var(--eth-glass); border: 1px solid var(--eth-border); padding: 1rem 1.75rem; border-radius: 12px; backdrop-filter: var(--glass-fx); display: flex; flex-direction: column; align-items: center; min-width: 90px; }
.m-val { font-family: 'Outfit', sans-serif; font-size: 1.8rem; font-weight: 900; line-height: 1; }
.m-label { font-size: 0.75rem; font-weight: 700; color: var(--text-dim); margin-top: 0.25rem; }

.ethereal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 1.5rem; }
.ethereal-card { background: var(--eth-glass); border: 1px solid var(--eth-border); border-radius: 16px; padding: 2.5rem; backdrop-filter: var(--glass-fx); transition: var(--anim-fluid); display: flex; flex-direction: column; gap: 1.25rem; }
.ethereal-card:hover { transform: translateY(-8px); border-color: rgba(99, 102, 241, 0.3); box-shadow: 0 40px 100px rgba(0,0,0,0.4); }

.e-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
.e-card-head h3 { font-size: 1.3rem; font-weight: 850; line-height: 1.2; }
.capsule-stack { display: flex; gap: 0.5rem; }
.capsule { padding: 0.35rem 0.85rem; border-radius: 20px; font-size: 0.75rem; font-weight: 800; border: none; cursor: default; }
.capsule.idle { background: rgba(139, 92, 246, 0.1); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.2); }
.capsule.edit { background: rgba(255,255,255,0.03); color: var(--text-dim); border: 1px solid var(--eth-border); cursor: pointer; transition: 0.2s; }
.capsule.edit:hover { background: rgba(255,255,255,0.08); color: white; }
.capsule.idle.fill { background: var(--p-indigo); color: white; border-color: var(--p-indigo); cursor: pointer; }
.capsule.idle.fill:hover { opacity: 0.9; }

.e-card-body p { font-size: 1rem; line-height: 1.6; color: var(--text-dim); }
.e-subtxt { font-size: 0.9rem; color: var(--text-muted); margin-top: 0.5rem; }

.e-card-foot { margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-weight: 600; border-top: 1px solid var(--eth-border); padding-top: 1.25rem; }
.e-date { font-size: 0.85rem; color: var(--text-muted); }
.e-link { color: var(--p-indigo); text-decoration: none; font-size: 0.9rem; transition: 0.2s; }
.e-link:hover { text-decoration: underline; }
.e-link-btn { background: none; border: none; color: var(--p-indigo); cursor: pointer; font-size: 0.9rem; font-weight: 600; font-family: 'Inter', sans-serif;}
.e-link-btn:hover { text-decoration: underline; }

/* Mission Control Context Toolbar */
.context-toolbar { margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem; background: rgba(99,102,241,0.05); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid rgba(99,102,241,0.1); }
.ctx-label { font-size: 0.8rem; color: var(--p-indigo); font-weight: 700; text-transform: uppercase; }
.pro-ctx-select { background: #010409; border: 1px solid var(--eth-border); color: white; padding: 0.4rem 0.75rem; border-radius: 6px; font-family: 'Inter', sans-serif; font-size: 0.85rem; outline: none; cursor: pointer;}
.pro-ctx-select:focus { border-color: var(--p-indigo); }

.ethereal-chat-portal { height: 70vh; display: flex; flex-direction: column; gap: 1rem; }
.chat-viewport-pro { flex: 1; overflow-y: auto; padding-right: 1.5rem; }
.chat-stream-pro { display: flex; flex-direction: column; gap: 2rem; }
.pro-msg-row { display: flex; }
.pro-msg-row.user { justify-content: flex-end; }
.pro-bubble { max-width: 80%; padding: 1.5rem 2rem; border-radius: 12px; background: var(--eth-glass); border: 1px solid var(--eth-border); line-height: 1.7; font-size: 1.05rem; }
.pro-bubble.nexus, .pro-bubble.nexus_thought { border-left: 3px solid var(--p-indigo); }
.pro-bubble.user { border-right: 3px solid var(--p-indigo); background: rgba(99, 102, 241, 0.05); }
.pro-meta { font-family: 'Outfit', sans-serif; font-size: 0.75rem; font-weight: 900; margin-bottom: 0.5rem; opacity: 0.5; color: var(--p-indigo); }

.input-bridge-pro { background: var(--eth-sidebar); border: 1px solid var(--eth-border); border-radius: 16px; padding: 1rem 1.5rem; margin-top: 1rem; }
.bridge-inner { display: flex; align-items: center; gap: 1.5rem; }
textarea { flex: 1; background: transparent; border: none; color: white; outline: none; font-size: 1rem; resize: none; height: 24px; font-weight: 500; }
.pro-fire-btn { width: 44px; height: 44px; border-radius: 10px; background: var(--p-indigo); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s; }
.pro-fire-btn:hover { background: #4f46e5; transform: scale(1.05); }

/* Settings */
.settings-ethereal-wrap { max-width: 650px; }
.settings-card-pro { background: var(--eth-glass); border: 1px solid var(--eth-border); border-radius: 20px; padding: 3rem; backdrop-filter: var(--glass-fx); }
.pro-field { margin-bottom: 2rem; }
.pro-field label { display: block; font-size: 0.85rem; font-weight: 800; color: var(--text-dim); margin-bottom: 0.85rem; }

.pro-input-wrap { position: relative; display: flex; align-items: center; }
.pro-input-wrap input { width: 100%; background: #010409; border: 1px solid var(--eth-border); border-radius: 10px; padding: 1rem 3rem 1rem 1.5rem; color: white; font-weight: 600; transition: 0.3s; }
.pro-input-wrap input:focus { border-color: var(--p-indigo); }
.eye-toggle { position: absolute; right: 1rem; background: none; border: none; font-size: 1.2rem; cursor: pointer; opacity: 0.6; transition: 0.2s; }
.eye-toggle:hover { opacity: 1; }

.quota-group { display: flex; gap: 1rem; background: #010409; padding: 0.5rem; border-radius: 10px; border: 1px solid var(--eth-border); }
.q-opt { flex: 1; text-align: center; padding: 0.75rem; border-radius: 6px; font-size: 0.85rem; font-weight: 700; color: var(--text-dim); cursor: pointer; transition: 0.3s; border: 1px solid transparent; }
.q-opt input { display: none; }
.q-opt.active { background: rgba(99,102,241,0.1); color: var(--p-indigo); border-color: rgba(99,102,241,0.3); }

.pro-save-btn { width: 100%; padding: 1.25rem; border-radius: 12px; background: var(--p-indigo); color: white; border: none; font-weight: 900; cursor: pointer; transition: 0.3s; }

/* Modals */
.ethereal-modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.ethereal-modal-content { background: var(--eth-sidebar); border: 1px solid var(--p-indigo); border-radius: 16px; padding: 3rem; width: 90%; max-width: 500px; box-shadow: 0 40px 100px rgba(0,0,0,0.8); }
.ethereal-modal-content h3 { font-family: 'Outfit', sans-serif; font-size: 1.6rem; font-weight: 900; margin-bottom: 0.25rem; }
.m-sub { color: var(--text-dim); font-size: 0.9rem; margin-bottom: 2rem; line-height: 1.4; }
.m-field { margin-bottom: 1.5rem; }
.m-field label { display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem; }
.m-field-compact { margin-bottom: 0.75rem; }
.m-field-compact label { display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.25rem; }
.compact-input { padding: 0.6rem 1rem !important; font-size: 0.85rem; }
.pro-input { width: 100%; background: #0d1117; border: 1px solid var(--eth-border); padding: 0.85rem 1.25rem; border-radius: 8px; color: white; outline: none; font-family: 'Inter', sans-serif;}
.pro-input:focus { border-color: var(--p-indigo); }

.keys-modal { max-height: 90vh; display: flex; flex-direction: column; }
.scroll-keys { overflow-y: auto; flex: 1; padding-right: 1rem; margin-bottom: 1rem; }
.scroll-keys::-webkit-scrollbar { width: 6px; }
.scroll-keys::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 4px; }

.pro-textarea { width: 100%; background: #0d1117; border: 1px solid var(--eth-border); padding: 0.85rem 1.25rem; border-radius: 8px; color: white; outline: none; font-family: 'Inter', sans-serif; resize: vertical; min-height: 80px; }
.pro-textarea:focus { border-color: var(--p-indigo); }
.status-indicator-pro { padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8rem; font-weight: 700; display: inline-block; margin-bottom: 0.5rem; }
.status-indicator-pro.active { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
.status-indicator-pro.missing { background: rgba(231, 76, 60, 0.1); color: var(--p-red); border: 1px solid rgba(231, 76, 60, 0.2); }
.guide-txt { font-size: 0.75rem; color: var(--text-dim); line-height: 1.5; }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2.5rem; }

.ethereal-toast { position: fixed; bottom: 3rem; right: 3rem; background: var(--eth-sidebar); border: 1px solid var(--p-indigo); color: white; padding: 1.25rem 2.5rem; border-radius: 12px; font-weight: 800; box-shadow: 0 20px 50px rgba(0,0,0,0.6); z-index: 10000; }

@media (max-width: 768px) {
  .sidebar-hud { display: none; }
  .main-viewport { width: 100vw; }
  .viewport-canvas { padding: 2rem; }
  .ethereal-grid { grid-template-columns: 1fr; }
  .metric-hud { position: static; margin-bottom: 2rem; width: 100%; }
  .quota-group { flex-direction: column; }
}

.portal-fade-enter-active, .portal-fade-leave-active { transition: all 0.4s ease; }
.portal-fade-enter-from { opacity: 0; transform: translateY(15px); }
.portal-fade-leave-to { opacity: 0; transform: translateY(-15px); }
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.3s cubic-bezier(0.19, 1, 0.22, 1); }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
