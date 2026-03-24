<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { io } from 'socket.io-client'

const socket = io()
const activeView = ref('chat')
const chatHistory = ref([{ sender: 'nexus', text: 'Mission control is online, Boss. Give me the objective.' }])
const runtimeLogs = ref([])
const sessionId = ref(localStorage.getItem('nexus_session_id'))
const promptInput = ref('')
const isWorking = ref(false)
const missionStatus = ref('idle')
const selectedClientForChat = ref('')
const chatContainer = ref(null)
const clients = ref([])
const toolsData = ref([])
const configEntries = ref([])
const configEdits = ref({})
const revealKeys = ref({})
const outputFiles = ref([])
const sessionCatalog = ref([])
const missionSummary = ref({ activeRun: null, recentRuns: [], totals: { missions: 0, successRate: 0, paused: 0, toolCalls: 0, llmCalls: 0, estimatedCostUsd: 0 }, queue: { jobs: [], totals: { queued: 0, paused: 0, completed: 0 } }, usage: { sessionEstimatedCostUsd: 0, completedJobs: 0 } })
const systemHealth = ref({ status: 'unknown', firestore: false })
const pricingCatalog = ref({})
const quotes = ref([])
const invoices = ref([])
const selectedFinanceClient = ref('')
const budgetSummary = ref({ allocated: 0, approvedOverage: 0, spent: 0, remaining: 0, requiresBossApproval: false })
const quoteDraft = ref({
  items: [{ serviceCode: 'banner_design', quantity: 1 }],
  profitMarginPct: 35,
  taxPct: 0,
  currency: 'USD',
  notes: ''
})
const isAddingClient = ref(false)
const isManagingClientKeys = ref(false)
const isEditingTool = ref(false)
const activeClient = ref(null)
const activeTool = ref(null)
const clientKeysList = ref([])
const clientKeyEdits = ref({})
const clientKeyEditing = ref('')
const clientKeyLabels = ref({})
const fileInput = ref(null)
const isMobileNavOpen = ref(false)
const isSidebarCollapsed = ref(false)
const isRailCollapsed = ref(false)
const isSummaryVisible = ref(true)
const theme = ref(localStorage.getItem('nexus_theme') || 'light')
const brandLogoUrl = 'https://jarvis-test-89c81.web.app/assets/nexusOS_logo.png'
const newClient = ref({ name: '', company: '', email: '', phone: '', notes: '', initialKeys: {} })
const configToast = ref({ show: false, message: '', type: 'success' })

const navItems = [
  { view: 'chat', label: 'Mission Control', eyebrow: 'Live operations' },
  { view: 'clients', label: 'Clients', eyebrow: 'Contexts and keys' },
  { view: 'finance', label: 'Finance', eyebrow: 'Quotes and invoices' },
  { view: 'tools', label: 'Capabilities', eyebrow: 'Provider readiness' },
  { view: 'settings', label: 'Settings', eyebrow: 'System configuration' }
]

const CLIENT_KEY_INFO = {
  GEMINI_API_KEY: { label: 'Gemini API Key 1', placeholder: 'AIza...', howTo: 'Create in Google AI Studio for primary inference.' },
  GEMINI_API_KEY_2: { label: 'Gemini API Key 2', placeholder: 'AIza...', howTo: 'Create a second key for failover rotation.' },
  BRAVE_SEARCH_API_KEY: { label: 'Brave Search API Key', placeholder: 'BSA...', howTo: 'Create in Brave Search API dashboard.' },
  META_ACCESS_TOKEN: { label: 'Meta Access Token', placeholder: 'EAA...', howTo: 'Use Meta Graph API tools to mint an access token.' },
  META_AD_ACCOUNT_ID: { label: 'Meta Ad Account ID', placeholder: 'act_123', howTo: 'Copy the ad account id from Meta Business settings.' },
  GOOGLE_ADS_CLIENT_ID: { label: 'Google Ads Client ID', placeholder: 'app.googleusercontent.com', howTo: 'Create OAuth credentials in Google Cloud.' },
  GOOGLE_ADS_CLIENT_SECRET: { label: 'Google Ads Client Secret', placeholder: 'GOCSPX...', howTo: 'Copy from the same OAuth credentials screen.' },
  GMAIL_USER: { label: 'Gmail Address', placeholder: 'team@agency.com', howTo: 'Mailbox used for send and read actions.' },
  GMAIL_APP_PASSWORD: { label: 'Gmail App Password', placeholder: '16-char app password', howTo: 'Generate from Google Account security settings.' }
}

const currentViewMeta = computed(() => navItems.find((item) => item.view === activeView.value) || navItems[0])
const activeClientName = computed(() => clients.value.find((client) => client.id === selectedClientForChat.value)?.name || 'System Default')
const activeIntegrationCount = computed(() => toolsData.value.filter((tool) => tool.status === 'active').length)
const latestRuns = computed(() => missionSummary.value.recentRuns.slice(0, 6))
const latestSessions = computed(() => sessionCatalog.value.slice(0, 5))
const recentAudit = computed(() => (missionSummary.value.auditTrail || []).slice(0, 6))
const recentQueue = computed(() => (missionSummary.value.queue?.jobs || []).slice(0, 6))
const recentRecovery = computed(() => (missionSummary.value.recoveryHistory || []).slice(0, 6))
const currentStage = computed(() => {
  const latest = runtimeLogs.value.at(-1)
  if (!latest) return { label: 'Idle', detail: 'Ready for the next mission.' }
  if (latest.type === 'step') return { label: 'Planning', detail: latest.message }
  if (latest.type === 'action') return { label: 'Executing Tool', detail: latest.name || 'Running tool' }
  if (latest.type === 'approval_requested') return { label: 'Awaiting Approval', detail: 'Boss confirmation required.' }
  if (latest.type === 'repair_suggested') return { label: 'Repair Mode', detail: 'Self-healing suggested a guided fix.' }
  if (latest.type === 'result') return { label: 'Reviewing Result', detail: 'Nexus is processing tool output.' }
  if (latest.type === 'error') return { label: 'Blocked', detail: latest.message || 'A system error occurred.' }
  return { label: 'Thinking', detail: latest.message || 'Mission is in progress.' }
})
const usdToInrRate = 83.5
let syncTimeout = null

watch(theme, (value) => {
  document.documentElement.setAttribute('data-theme', value)
  localStorage.setItem('nexus_theme', value)
}, { immediate: true })

watch(chatHistory, () => {
  if (!sessionId.value) return
  clearTimeout(syncTimeout)
  syncTimeout = setTimeout(() => {
    socket.emit('sync_history', { history: JSON.parse(JSON.stringify(chatHistory.value)), logs: JSON.parse(JSON.stringify(runtimeLogs.value)) })
  }, 500)
}, { deep: true })

function showToast(message, type = 'success') {
  configToast.value = { show: true, message, type }
  setTimeout(() => { configToast.value.show = false }, 2600)
}

async function scrollToBottom() {
  await nextTick()
  if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight
}

function formatMessage(text) { return text ? text.replace(/\n/g, '<br>') : '' }
function prettyDate(value) { return value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : 'No timestamp' }
function dualCurrency(value) {
  const usd = Number(value || 0)
  const inr = usd * usdToInrRate
  return `$${usd.toFixed(2)} / Rs.${inr.toFixed(0)}`
}
async function fetchJson(url, options) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Request failed')
  return data
}

async function openSettings() {
  activeView.value = 'settings'
  const data = await fetchJson('/api/config')
  configEntries.value = data.configs || []
  const edits = {}, reveals = {}
  for (const entry of configEntries.value) {
    edits[entry.key] = entry.isSet ? entry.value : ''
    reveals[entry.key] = false
    if (entry.key === 'QUOTA_MODE' && !edits[entry.key]) edits[entry.key] = 'FREE'
  }
  configEdits.value = edits
  revealKeys.value = reveals
}

async function saveConfig() {
  const updates = {}
  for (const [key, value] of Object.entries(configEdits.value)) if (value !== '') updates[key] = value
  await fetchJson('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates }) })
  showToast('System configuration updated')
}

async function loadClients() { clients.value = (await fetchJson('/api/clients')).clients || [] }
async function loadToolsDashboard() { toolsData.value = (await fetchJson('/api/system-status')).integrations || [] }
async function loadSessionCatalog() { sessionCatalog.value = (await fetchJson('/api/sessions')).sessions || [] }
async function loadSystemHealth() { systemHealth.value = await fetchJson('/api/health') }
async function loadPricingCatalog() { pricingCatalog.value = (await fetchJson('/api/pricing/catalog')).catalog || {} }
async function loadQuotes() { quotes.value = (await fetchJson(`/api/quotes${selectedFinanceClient.value ? `?clientId=${selectedFinanceClient.value}` : ''}`)).quotes || [] }
async function loadInvoices() { invoices.value = (await fetchJson(`/api/invoices${selectedFinanceClient.value ? `?clientId=${selectedFinanceClient.value}` : ''}`)).invoices || [] }
async function loadBudget() {
  if (!selectedFinanceClient.value) return
  budgetSummary.value = (await fetchJson(`/api/clients/${selectedFinanceClient.value}/budget`)).budget
}

async function ensureBudgetApproval(clientId) {
  if (!clientId) return true
  const budget = (await fetchJson(`/api/clients/${clientId}/budget`)).budget
  if (!budget.requiresBossApproval) return true
  return window.confirm(`This client is over budget by ${Math.abs(Number(budget.remaining || 0)).toFixed(2)}. Do you approve continuing anyway, Boss?`)
}

async function createQuote() {
  if (!selectedFinanceClient.value) return showToast('Select a client for finance actions, Boss', 'error')
  await fetchJson('/api/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: selectedFinanceClient.value,
      ...quoteDraft.value
    })
  })
  showToast('Quote created')
  await Promise.all([loadQuotes(), loadBudget()])
}

async function createInvoiceFromQuote(quoteId) {
  await fetchJson(`/api/invoices/from-quote/${quoteId}`, { method: 'POST' })
  showToast('Invoice generated')
  await Promise.all([loadQuotes(), loadInvoices(), loadBudget()])
}

async function markInvoicePaid(invoiceId) {
  await fetchJson(`/api/invoices/${invoiceId}/pay`, { method: 'POST' })
  showToast('Invoice marked paid')
  await Promise.all([loadInvoices(), loadBudget()])
}

function downloadInvoice(invoiceId, format) {
  window.open(`/api/invoices/${invoiceId}/export?format=${format}`, '_blank')
}

async function sendInvoice(invoiceId) {
  const data = await fetchJson(`/api/invoices/${invoiceId}/send`, { method: 'POST' })
  showToast(`Invoice sent to ${data.sentTo}`)
  await loadInvoices()
}

async function saveClient() {
  if (!newClient.value.name.trim()) return showToast('Client name is required, Boss', 'error')
  await fetchJson('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newClient.value) })
  newClient.value = { name: '', company: '', email: '', phone: '', notes: '', initialKeys: {} }
  clientKeyEditing.value = ''
  isAddingClient.value = false
  showToast('Client created')
  await loadClients()
}

async function manageClientKeys(client) {
  activeClient.value = client
  const data = await fetchJson(`/api/clients/${client.id}/keys`)
  clientKeysList.value = data.keys || []
  const edits = {}
  for (const item of clientKeysList.value) edits[item.key] = item.isSet ? item.value : ''
  clientKeyEdits.value = edits
  isManagingClientKeys.value = true
}

async function saveClientKeys() {
  await fetchJson(`/api/clients/${activeClient.value.id}/keys`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: clientKeyEdits.value }) })
  isManagingClientKeys.value = false
  showToast('Client keys saved')
}

async function editTool(tool) {
  activeTool.value = tool
  const data = await fetchJson('/api/config')
  const rulesKey = `TOOL_${tool.id.toUpperCase()}_RULES`
  const existing = (data.configs || []).find((entry) => entry.key === rulesKey)
  configEdits.value[rulesKey] = existing?.isSet ? existing.value : configEdits.value[rulesKey] || ''
  isEditingTool.value = true
}

async function updateToolConfig() { await saveConfig(); isEditingTool.value = false; showToast(`${activeTool.value.name} guidance saved`) }
function testTool(tool) { activeView.value = 'chat'; promptInput.value = `Run a diagnostic on ${tool.name}. Validate readiness, note blockers, and give me the operational status.`; submitTask() }

async function handleFileUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch('/upload', { method: 'POST', body: formData })
  const data = await response.json()
  if (!response.ok) return showToast('Upload failed, Boss', 'error')
  promptInput.value = `${promptInput.value}${promptInput.value ? '\n' : ''}[Context File Loaded: Path: \`${data.path}\`]`
  showToast('File attached to mission context')
}

async function submitTask() {
  const prompt = promptInput.value.trim()
  if (!prompt || isWorking.value) return
  const budgetApproved = await ensureBudgetApproval(selectedClientForChat.value || null)
  if (!budgetApproved) {
    showToast('Mission paused due to budget limit', 'error')
    return
  }
  const prefix = selectedClientForChat.value ? `[Client Context: ${activeClientName.value}] ` : ''
  chatHistory.value.push({ sender: 'user', text: `${prefix}${prompt}` })
  promptInput.value = ''
  isWorking.value = true
  const isPaused = missionStatus.value === 'paused'
  missionStatus.value = 'active'
  if (isPaused) socket.emit('user_input', { prompt, clientId: selectedClientForChat.value || null })
  else socket.emit('start_task', { prompt, clientId: selectedClientForChat.value || null })
  scrollToBottom()
}

function terminateTask() {
  socket.emit('stop_task')
  isWorking.value = false
  missionStatus.value = 'idle'
  chatHistory.value.push({ sender: 'nexus_error', text: 'Mission stopped by the Boss.' })
  scrollToBottom()
}

function startNewOrchestration() {
  socket.emit('start_new_session')
  chatHistory.value = [{ sender: 'nexus', text: 'Fresh session started, Boss. Define the next agency objective.' }]
  runtimeLogs.value = []
  outputFiles.value = []
  promptInput.value = ''
  isWorking.value = false
  missionStatus.value = 'idle'
  activeView.value = 'chat'
}

function changeView(view) {
  activeView.value = view
  isMobileNavOpen.value = false
  if (view === 'clients') loadClients()
  if (view === 'finance') { loadPricingCatalog(); loadQuotes(); loadInvoices(); if (selectedFinanceClient.value) loadBudget() }
  if (view === 'tools') loadToolsDashboard()
  if (view === 'settings') openSettings()
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

function requeueJob(jobId) {
  socket.emit('requeue_job', { jobId })
}

function retryJobNow(jobId) {
  socket.emit('retry_now', { jobId })
}

async function enableNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return showToast('Notifications are not supported in this browser, Boss', 'error')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return showToast('Notification permission was not granted', 'error')
  }
  const registration = await navigator.serviceWorker.ready
  registration.active?.postMessage({
    type: 'SHOW_NOTIFICATION',
    title: 'Nexus OS',
    body: 'Local notifications are active for the Boss.'
  })
  showToast('Notifications enabled')
}

onMounted(async () => {
  socket.emit('join_session', { sessionId: sessionId.value })
  socket.on('session_created', (data) => { sessionId.value = data.sessionId; localStorage.setItem('nexus_session_id', data.sessionId) })
  socket.on('session_recovered', (data) => {
    sessionId.value = data.sessionId
    localStorage.setItem('nexus_session_id', data.sessionId)
    if (data.history?.length) chatHistory.value = data.history
    if (data.logs?.length) runtimeLogs.value = data.logs
  })
  socket.on('nexus_log', (data) => {
    runtimeLogs.value.push({ ...data, at: new Date().toISOString() })
    runtimeLogs.value = runtimeLogs.value.slice(-200)
    if (data.type === 'thought' || data.type === 'action') {
      const last = chatHistory.value.at(-1)
      const message = data.message || `Running ${data.name}`
      if (last && last.sender === 'nexus_thought') last.text = message
      else chatHistory.value.push({ sender: 'nexus_thought', text: message })
    } else if (data.type === 'result' && data.message) {
      chatHistory.value.push({ sender: 'nexus_result', text: String(data.message) })
    } else if (data.type === 'complete') {
      chatHistory.value.push({ sender: 'nexus', text: data.message || 'Mission completed.' })
      isWorking.value = false
      missionStatus.value = 'idle'
      loadSessionCatalog()
    } else if (data.type === 'pause' || data.type === 'input_requested' || data.type === 'approval_requested' || data.type === 'repair_suggested') {
      if (data.message) chatHistory.value.push({ sender: 'nexus_thought', text: data.message })
      isWorking.value = false
      missionStatus.value = 'paused'
    } else if (data.type === 'error') {
      chatHistory.value.push({ sender: 'nexus_error', text: data.message || 'System error' })
      isWorking.value = false
      missionStatus.value = 'idle'
      loadSessionCatalog()
    }
    scrollToBottom()
  })
  socket.on('outputs_list', (data) => { outputFiles.value = data.files || [] })
  socket.on('mission_state', (data) => { missionSummary.value = data || missionSummary.value; if (data?.activeRun) missionStatus.value = 'active' })
  clientKeyLabels.value = (await fetchJson('/api/client-key-labels')).labels || {}
  await Promise.allSettled([loadClients(), loadToolsDashboard(), loadSessionCatalog(), loadSystemHealth()])
})

onBeforeUnmount(() => {
  socket.off('session_created')
  socket.off('session_recovered')
  socket.off('nexus_log')
  socket.off('outputs_list')
  socket.off('mission_state')
})
</script>

<template>
  <div class="app-shell" :class="{ compact: isSidebarCollapsed, railHidden: isRailCollapsed }">
    <aside class="sidebar" :class="{ open: isMobileNavOpen, collapsed: isSidebarCollapsed }">
      <div class="brand">
        <div class="brand-mark">
          <img :src="brandLogoUrl" alt="Nexus OS icon" class="brand-icon-image" />
        </div>
        <div class="brand-copy">
          <img :src="brandLogoUrl" alt="Nexus OS" class="brand-logo-image" />
          <p class="brand-sub">Agency cockpit</p>
        </div>
      </div>
      <div class="sidebar-stack">
        <button v-for="item in navItems" :key="item.view" class="nav-item" :class="{ active: activeView === item.view }" @click="changeView(item.view)">
          <span class="nav-title">{{ item.label }}</span><span class="nav-sub">{{ item.eyebrow }}</span>
        </button>
      </div>
      <div class="sidebar-card"><span class="tiny-label">System</span><strong>{{ systemHealth.status }}</strong><span class="tiny-copy">Firestore {{ systemHealth.firestore ? 'connected' : 'offline' }}</span></div>
      <div class="sidebar-card"><span class="tiny-label">Context</span><strong>{{ activeClientName }}</strong><span class="tiny-copy">Session {{ sessionId || 'pending' }}</span></div>
    </aside>

    <main class="workspace" :class="{ 'chat-mode': activeView === 'chat' }">
      <header class="topbar">
        <div><p class="eyebrow">{{ currentViewMeta.eyebrow }}</p><h1>{{ currentViewMeta.label }}</h1></div>
        <div class="action-row topbar-actions">
          <button class="ghost" @click="isSidebarCollapsed = !isSidebarCollapsed">{{ isSidebarCollapsed ? 'Show Left' : 'Hide Left' }}</button>
          <button class="ghost" @click="isRailCollapsed = !isRailCollapsed">{{ isRailCollapsed ? 'Show Right' : 'Hide Right' }}</button>
          <button v-if="!isRailCollapsed" class="ghost" @click="isSummaryVisible = !isSummaryVisible">{{ isSummaryVisible ? 'Hide Overview' : 'Show Overview' }}</button>
          <button class="ghost" @click="enableNotifications">Enable Alerts</button>
          <button class="ghost" @click="toggleTheme">{{ theme === 'dark' ? 'Light Theme' : 'Dark Theme' }}</button>
          <button class="ghost mobile-only" @click="isMobileNavOpen = !isMobileNavOpen">Menu</button>
          <button v-if="activeView === 'clients'" class="primary" @click="isAddingClient = true">Add Client</button>
          <button v-else class="primary" @click="startNewOrchestration">New Session</button>
        </div>
      </header>

      <section v-if="activeView !== 'chat'" class="hero-grid compact-bar" :class="{ expanded: isRailCollapsed, docked: !isRailCollapsed }">
        <article class="hero-card">
          <span class="tiny-label">Mission posture</span>
          <h2>{{ missionStatus === 'active' ? 'Operation in progress' : missionStatus === 'paused' ? 'Awaiting Boss input' : 'Ready for next mission' }}</h2>
          <p class="muted">Run client missions, review outputs, monitor queue health, and track estimated usage from one place.</p>
          <div class="pill-row"><span class="pill">{{ missionSummary.totals.missions }} missions</span><span class="pill">{{ missionSummary.totals.successRate }}% success</span><span class="pill">{{ activeIntegrationCount }} integrations</span><span class="pill">{{ dualCurrency(missionSummary.usage?.sessionEstimatedCostUsd || 0) }} est. cost</span></div>
        </article>
        <article class="metric-card compact-metric"><span class="tiny-label">Tools</span><strong>{{ missionSummary.totals.toolCalls }}</strong><p>Total calls</p></article>
        <article class="metric-card compact-metric"><span class="tiny-label">Queue</span><strong>{{ missionSummary.queue?.totals?.queued || 0 }}</strong><p>Waiting missions</p></article>
        <article class="metric-card compact-metric"><span class="tiny-label">Usage</span><strong>{{ missionSummary.totals.llmCalls || 0 }}</strong><p>LLM calls</p></article>
      </section>

      <section v-if="activeView === 'chat'" class="chat-layout">
        <div class="panel panel-chat">
          <div class="panel-head">
            <div><span class="tiny-label">Live mission</span><h3>Boss stream</h3></div>
            <div class="context-box"><label>Context</label><select v-model="selectedClientForChat"><option value="">System Default</option><option v-for="client in clients" :key="client.id" :value="client.id">{{ client.name }}</option></select></div>
          </div>
          <div class="stage-strip">
            <div class="stage-card">
              <span class="tiny-label">Stage</span>
              <strong>{{ currentStage.label }}</strong>
            </div>
            <div class="stage-card stage-detail">
              <span class="tiny-label">Status</span>
              <strong>{{ currentStage.detail }}</strong>
            </div>
            <div class="stage-card">
              <span class="tiny-label">Run State</span>
              <strong>{{ missionStatus === 'active' ? 'Mission running' : missionStatus === 'paused' ? 'Awaiting Boss' : 'Standing by' }}</strong>
            </div>
          </div>
          <div ref="chatContainer" class="chat-stream">
            <div v-for="(msg, index) in chatHistory" :key="index" class="message-row" :class="msg.sender">
              <div class="message-card" :class="msg.sender"><span class="tiny-label">{{ msg.sender.startsWith('nexus') ? 'Nexus' : 'Boss' }}</span><div class="message-text" v-html="formatMessage(msg.text)"></div></div>
            </div>
          </div>
          <div class="composer">
            <div class="action-row"><button class="ghost" @click="fileInput.click()">Attach File</button><input ref="fileInput" type="file" class="hidden-input" @change="handleFileUpload" /></div>
            <textarea v-model="promptInput" placeholder="Describe the mission, expected result, and constraints." @keydown.enter.exact.prevent="submitTask"></textarea>
            <div class="action-row"><button v-if="isWorking || missionStatus === 'paused'" class="danger" @click="terminateTask">Stop</button><button v-else class="primary" @click="submitTask">Launch</button></div>
          </div>
        </div>
        <div class="rail" v-show="!isRailCollapsed">
          <div v-if="isSummaryVisible" class="panel summary-panel">
            <div class="panel-head"><div><span class="tiny-label">Operations</span><h3>Mission overview</h3></div></div>
            <div class="summary-scroll">
              <article class="hero-card summary-hero">
                <span class="tiny-label">Mission posture</span>
                <h2>{{ missionStatus === 'active' ? 'Operation in progress' : missionStatus === 'paused' ? 'Awaiting Boss input' : 'Ready for next mission' }}</h2>
                <p class="muted">Run client missions, review outputs, monitor queue health, and track estimated usage from one place.</p>
                <div class="pill-row">
                  <span class="pill">{{ missionSummary.totals.missions }} missions</span>
                  <span class="pill">{{ missionSummary.totals.successRate }}% success</span>
                  <span class="pill">{{ activeIntegrationCount }} integrations</span>
                  <span class="pill">{{ dualCurrency(missionSummary.usage?.sessionEstimatedCostUsd || 0) }} est. cost</span>
                </div>
              </article>
              <div class="summary-metrics">
                <article class="metric-card compact-metric"><span class="tiny-label">Tools</span><strong>{{ missionSummary.totals.toolCalls }}</strong><p>Total calls</p></article>
                <article class="metric-card compact-metric"><span class="tiny-label">Queue</span><strong>{{ missionSummary.queue?.totals?.queued || 0 }}</strong><p>Waiting missions</p></article>
                <article class="metric-card compact-metric"><span class="tiny-label">Usage</span><strong>{{ missionSummary.totals.llmCalls || 0 }}</strong><p>LLM calls</p></article>
              </div>
            </div>
          </div>
          <div v-if="missionSummary.pendingApproval" class="panel">
            <div class="panel-head"><div><span class="tiny-label">Approval gate</span><h3>Boss confirmation needed</h3></div></div>
            <div class="stack-item">
              <strong>{{ missionSummary.pendingApproval.toolCall?.name }}</strong>
              <p class="muted">{{ missionSummary.pendingApproval.reason }}</p>
              <p class="muted">{{ missionSummary.pendingApproval.preview }}</p>
              <pre v-if="missionSummary.pendingApproval.details" class="approval-json">{{ JSON.stringify(missionSummary.pendingApproval.details, null, 2) }}</pre>
            </div>
          </div>
          <div v-if="missionSummary.pendingRepair" class="panel">
            <div class="panel-head"><div><span class="tiny-label">Self-healing</span><h3>Repair mode suggested</h3></div></div>
            <div class="stack-item">
              <strong>{{ missionSummary.pendingRepair.classification?.type }}</strong>
              <p class="muted">{{ missionSummary.pendingRepair.classification?.summary }}</p>
              <p class="muted">{{ missionSummary.pendingRepair.playbook?.message }}</p>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><div><span class="tiny-label">Queue</span><h3>Durable mission queue</h3></div></div>
            <div v-if="recentQueue.length" class="stack-list"><div v-for="job in recentQueue" :key="job.id" class="stack-item"><div class="run-head"><strong>{{ job.prompt }}</strong><span class="badge" :class="job.status">{{ job.status }}</span></div><p class="muted">{{ prettyDate(job.createdAt) }} · {{ job.clientId || 'system' }}</p></div></div>
            <p v-else class="muted">Queued missions will appear here.</p>
          </div>
          <div class="panel">
            <div class="panel-head"><div><span class="tiny-label">Queue controls</span><h3>Replay and retry</h3></div></div>
            <div v-if="recentQueue.some(job => job.status === 'dead_letter' || job.status === 'cancelled' || job.status === 'failed' || job.status === 'retry_wait')" class="stack-list"><div v-for="job in recentQueue.filter(job => job.status === 'dead_letter' || job.status === 'cancelled' || job.status === 'failed' || job.status === 'retry_wait')" :key="job.id + '-control'" class="stack-item"><div class="run-head"><strong>{{ job.status }}</strong><span>{{ prettyDate(job.createdAt) }}</span></div><p class="muted">{{ job.prompt }}</p><div class="action-row" v-if="job.status === 'retry_wait'"><button class="ghost" @click="retryJobNow(job.id)">Retry Now</button></div><div class="action-row" v-else><button class="ghost" @click="requeueJob(job.id)">Requeue</button></div></div></div>
            <p v-else class="muted">No manual queue actions needed right now.</p>
          </div>
          <div class="panel">
            <div class="panel-head"><div><span class="tiny-label">Outputs</span><h3>Session files</h3></div><button class="ghost" @click="socket.emit('get_outputs')">Refresh</button></div>
            <div v-if="outputFiles.length" class="stack-list"><a v-for="file in outputFiles" :key="file.url" :href="file.url" target="_blank" rel="noreferrer" class="stack-item"><span>{{ file.name }}</span><span>Open</span></a></div>
            <p v-else class="muted">Generated files will appear here.</p>
          </div>
          <div class="panel">
            <div class="panel-head"><div><span class="tiny-label">Recent runs</span><h3>Execution quality</h3></div></div>
            <div v-if="latestRuns.length" class="stack-list"><div v-for="run in latestRuns" :key="run.id" class="stack-item"><div class="run-head"><strong>{{ run.requestPreview }}</strong><span class="badge" :class="run.status">{{ run.status }}</span></div><p class="muted">{{ prettyDate(run.startedAt) }} · {{ run.toolCalls || 0 }} tools · {{ run.steps || 0 }} steps · ${{ Number(run.estimatedCostUsd || 0).toFixed(4) }}</p></div></div>
            <p v-else class="muted">No tracked runs yet.</p>
          </div>
          <div class="panel">
            <div class="panel-head"><div><span class="tiny-label">Audit trail</span><h3>High-risk actions</h3></div></div>
            <div v-if="recentAudit.length" class="stack-list"><div v-for="entry in recentAudit" :key="entry.at + entry.type" class="stack-item"><div class="run-head"><strong>{{ entry.type }}</strong><span>{{ prettyDate(entry.at) }}</span></div><p class="muted">{{ entry.payload?.tool || 'system' }}</p></div></div>
            <p v-else class="muted">No approval events recorded yet.</p>
          </div>
          <div class="panel">
            <div class="panel-head"><div><span class="tiny-label">Recovery log</span><h3>Self-healing memory</h3></div></div>
            <div v-if="recentRecovery.length" class="stack-list"><div v-for="entry in recentRecovery" :key="entry.at + entry.tool" class="stack-item"><div class="run-head"><strong>{{ entry.classification?.type }}</strong><span>{{ prettyDate(entry.at) }}</span></div><p class="muted">{{ entry.tool }}</p></div></div>
            <p v-else class="muted">No recovery events captured yet.</p>
          </div>
        </div>
      </section>

      <section v-else-if="activeView === 'clients'" class="grid-two">
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Client operations</span><h3>Accounts and isolated keys</h3></div><button class="ghost" @click="loadClients">Refresh</button></div>
          <div class="card-grid"><div v-for="client in clients" :key="client.id" class="mini-card"><div class="run-head"><strong>{{ client.name }}</strong><span class="badge success">{{ client.status || 'active' }}</span></div><p class="muted">{{ client.company || 'No organization listed' }}</p><p class="muted">{{ client.email || 'No email set' }}</p><div class="action-row"><button class="ghost" @click="manageClientKeys(client)">Keys</button><button class="primary subtle" @click="activeView = 'chat'; selectedClientForChat = client.id">Use Context</button></div></div></div>
        </div>
        <div class="panel"><div class="panel-head"><div><span class="tiny-label">Sessions</span><h3>Recent recoveries</h3></div></div><div v-if="latestSessions.length" class="stack-list"><div v-for="session in latestSessions" :key="session.id" class="stack-item"><strong>{{ session.preview }}</strong><p class="muted">{{ prettyDate(session.lastUpdated) }}</p></div></div><p v-else class="muted">Saved sessions will appear here.</p></div>
      </section>

      <section v-else-if="activeView === 'finance'" class="grid-two">
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Finance</span><h3>Quote and invoice control</h3></div><div class="context-box"><label>Client</label><select v-model="selectedFinanceClient" @change="loadQuotes(); loadInvoices(); loadBudget()"><option value="">Select Client</option><option v-for="client in clients" :key="client.id" :value="client.id">{{ client.name }}</option></select></div></div>
          <div class="card-grid">
            <div class="mini-card"><label>Service</label><select v-model="quoteDraft.items[0].serviceCode"><option v-for="(info, code) in pricingCatalog" :key="code" :value="code">{{ info.label }}</option></select></div>
            <div class="mini-card"><label>Quantity</label><input v-model="quoteDraft.items[0].quantity" type="number" min="1"></div>
            <div class="mini-card"><label>Profit %</label><input v-model="quoteDraft.profitMarginPct" type="number" min="0"></div>
            <div class="mini-card"><label>Tax %</label><input v-model="quoteDraft.taxPct" type="number" min="0"></div>
            <div class="mini-card full"><label>Notes</label><textarea v-model="quoteDraft.notes" placeholder="Scope, timelines, add-ons, approval notes."></textarea></div>
          </div>
          <div class="action-row"><button class="primary" @click="createQuote">Create Quote</button></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Budget</span><h3>Client budget status</h3></div></div>
          <div class="stack-list">
            <div class="stack-item"><strong>Allocated</strong><p class="muted">{{ dualCurrency(budgetSummary.allocated || 0) }}</p></div>
            <div class="stack-item"><strong>Approved Overage</strong><p class="muted">{{ dualCurrency(budgetSummary.approvedOverage || 0) }}</p></div>
            <div class="stack-item"><strong>Spent</strong><p class="muted">{{ dualCurrency(budgetSummary.spent || 0) }}</p></div>
            <div class="stack-item"><strong>Remaining</strong><p class="muted">{{ dualCurrency(budgetSummary.remaining || 0) }}</p><p v-if="budgetSummary.requiresBossApproval" class="muted">Boss approval required for excess work.</p></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Quotes</span><h3>Prepared offers</h3></div></div>
          <div v-if="quotes.length" class="stack-list"><div v-for="quote in quotes.slice(0, 6)" :key="quote.id" class="stack-item"><div class="run-head"><strong>{{ quote.pricing?.items?.[0]?.description || 'Quote' }}</strong><span class="badge">{{ quote.status }}</span></div><p class="muted">{{ dualCurrency(quote.pricing?.total || 0) }}</p><div class="action-row"><button class="ghost" @click="createInvoiceFromQuote(quote.id)">Create Invoice</button></div></div></div>
          <p v-else class="muted">No quotes yet.</p>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Invoices</span><h3>Payment status</h3></div></div>
          <div v-if="invoices.length" class="stack-list"><div v-for="invoice in invoices.slice(0, 6)" :key="invoice.id" class="stack-item"><div class="run-head"><strong>Invoice {{ invoice.id.slice(0, 8) }}</strong><span class="badge" :class="invoice.status === 'paid' ? 'success' : 'warning'">{{ invoice.status }}</span></div><p class="muted">{{ dualCurrency(invoice.pricing?.total || 0) }} · <a :href="invoice.paymentUrl" target="_blank" rel="noreferrer">Pay</a></p><div class="action-row"><button class="ghost" @click="downloadInvoice(invoice.id, 'pdf')">PDF</button><button class="ghost" @click="downloadInvoice(invoice.id, 'csv')">Excel</button><button class="ghost" @click="sendInvoice(invoice.id)">Send</button><button v-if="invoice.status !== 'paid'" class="ghost" @click="markInvoicePaid(invoice.id)">Mark Paid</button></div></div></div>
          <p v-else class="muted">No invoices yet.</p>
        </div>
      </section>

      <section v-else-if="activeView === 'tools'" class="panel">
        <div class="panel-head"><div><span class="tiny-label">Capabilities</span><h3>Provider readiness matrix</h3></div><button class="ghost" @click="loadToolsDashboard">Refresh</button></div>
        <div class="card-grid"><div v-for="tool in toolsData" :key="tool.id" class="mini-card"><div class="run-head"><strong>{{ tool.name }}</strong><span class="badge" :class="tool.status === 'active' ? 'success' : 'warning'">{{ tool.status }}</span></div><p class="muted">{{ tool.description }}</p><p class="muted" v-if="tool.diagnostics?.missingKeys?.length">Missing: {{ tool.diagnostics.missingKeys.join(', ') }}</p><p class="muted" v-else-if="tool.diagnostics?.ready">Ready: {{ (tool.diagnostics.configuredKeys || []).join(', ') || 'configured' }}</p><div class="action-row"><button class="ghost" @click="editTool(tool)">Configure</button><button class="primary subtle" @click="testTool(tool)">Test</button></div></div></div>
      </section>

      <section v-else class="panel">
        <div class="panel-head"><div><span class="tiny-label">Configuration</span><h3>Keys and quota controls</h3></div></div>
        <div class="card-grid"><div v-for="entry in configEntries" :key="entry.key" class="mini-card"><label>{{ entry.label }}</label><select v-if="entry.key === 'QUOTA_MODE'" v-model="configEdits[entry.key]"><option value="FREE">FREE</option><option value="NORMAL">NORMAL</option><option value="HIGH">HIGH</option></select><div v-else class="inline-input"><input :type="revealKeys[entry.key] ? 'text' : 'password'" v-model="configEdits[entry.key]" :placeholder="entry.isSet ? 'Configured' : 'Unset'"><button class="ghost" @click="revealKeys[entry.key] = !revealKeys[entry.key]">{{ revealKeys[entry.key] ? 'Hide' : 'Show' }}</button></div></div></div>
        <div class="action-row"><button class="primary" @click="saveConfig">Save Settings</button></div>
      </section>
    </main>

    <transition name="fade"><div v-if="isAddingClient" class="modal-backdrop" @click.self="isAddingClient = false"><div class="modal-card"><div class="panel-head"><div><span class="tiny-label">New client</span><h3>Create isolated operating context</h3></div><button class="ghost" @click="isAddingClient = false">Close</button></div><div class="card-grid"><div class="mini-card"><label>Name</label><input v-model="newClient.name" placeholder="Acme Growth"></div><div class="mini-card"><label>Company</label><input v-model="newClient.company" placeholder="Acme Pvt Ltd"></div><div class="mini-card"><label>Email</label><input v-model="newClient.email" placeholder="team@acme.com"></div><div class="mini-card"><label>Phone</label><input v-model="newClient.phone" placeholder="+91..."></div><div class="mini-card full"><label>Notes</label><textarea v-model="newClient.notes" placeholder="Brand, goals, constraints, operating notes."></textarea></div><div v-for="(info, key) in CLIENT_KEY_INFO" :key="key" class="mini-card"><div class="run-head"><label>{{ info.label }}</label><button class="link-btn" @click="clientKeyEditing = clientKeyEditing === key ? '' : key">How to get</button></div><p v-if="clientKeyEditing === key" class="muted">{{ info.howTo }}</p><input type="password" v-model="newClient.initialKeys[key]" :placeholder="info.placeholder"></div></div><div class="action-row"><button class="ghost" @click="isAddingClient = false">Cancel</button><button class="primary" @click="saveClient">Create Client</button></div></div></div></transition>
    <transition name="fade"><div v-if="isManagingClientKeys && activeClient" class="modal-backdrop" @click.self="isManagingClientKeys = false"><div class="modal-card"><div class="panel-head"><div><span class="tiny-label">Key management</span><h3>{{ activeClient.name }}</h3></div><button class="ghost" @click="isManagingClientKeys = false">Close</button></div><div class="card-grid"><div v-for="keyRow in clientKeysList" :key="keyRow.key" class="mini-card"><label>{{ keyRow.label || clientKeyLabels[keyRow.key] || keyRow.key }}</label><input type="password" v-model="clientKeyEdits[keyRow.key]" :placeholder="keyRow.isSet ? 'Configured' : 'Unset'"></div></div><div class="action-row"><button class="primary" @click="saveClientKeys">Save Keys</button></div></div></div></transition>
    <transition name="fade"><div v-if="isEditingTool && activeTool" class="modal-backdrop" @click.self="isEditingTool = false"><div class="modal-card"><div class="panel-head"><div><span class="tiny-label">Capability tuning</span><h3>{{ activeTool.name }}</h3></div><button class="ghost" @click="isEditingTool = false">Close</button></div><div class="mini-card"><p class="muted">{{ activeTool.description }}</p><span class="badge" :class="activeTool.status === 'active' ? 'success' : 'warning'">{{ activeTool.status === 'active' ? 'Operational' : 'Needs credentials' }}</span></div><div class="mini-card"><label>Operational rules</label><textarea v-model="configEdits[`TOOL_${activeTool.id.toUpperCase()}_RULES`]" placeholder="Example: Always return JSON with a short summary and risk flags."></textarea></div><div class="action-row"><button class="ghost" @click="testTool(activeTool)">Run Test</button><button class="primary" @click="updateToolConfig">Save Guidance</button></div></div></div></transition>
    <div v-if="configToast.show" class="toast" :class="configToast.type">{{ configToast.message }}</div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Manrope:wght@400;500;700;800&display=swap');

:root {
  --bg: #f4efe6;
  --bg-overlay-1: rgba(204, 92, 45, 0.17);
  --bg-overlay-2: rgba(47, 90, 75, 0.16);
  --surface: rgba(255, 252, 247, 0.84);
  --surface-strong: rgba(255, 248, 239, 0.96);
  --sidebar: rgba(248, 241, 232, 0.78);
  --ink: #1f1d1a;
  --muted: #6e655b;
  --line: rgba(74, 53, 35, 0.14);
  --accent: #cc5c2d;
  --accent-2: #aa4624;
  --brand-glow: rgba(161, 61, 38, 0.28);
  --olive: #2f5a4b;
  --warn: #b56a17;
  --danger: #b53d2b;
  --user-chat-start: #2f5a4b;
  --user-chat-end: #1e4236;
  --chat-user-ink: #f6f4f0;
  --hero-start: rgba(255, 247, 240, 0.98);
  --hero-end: rgba(244, 232, 219, 0.9);
  --ghost-bg: rgba(255, 250, 244, 0.72);
  --input-bg: rgba(255, 251, 246, 0.88);
  --stack-bg: rgba(255, 251, 246, 0.78);
  --shadow: 0 30px 70px rgba(58, 35, 19, 0.14);
}

:root[data-theme='dark'] {
  --bg: #0b0716;
  --bg-overlay-1: rgba(82, 40, 151, 0.38);
  --bg-overlay-2: rgba(15, 11, 36, 0.92);
  --surface: rgba(18, 14, 36, 0.82);
  --surface-strong: rgba(20, 16, 40, 0.94);
  --sidebar: rgba(10, 8, 24, 0.86);
  --ink: #f5f2ff;
  --muted: #a59bc8;
  --line: rgba(131, 108, 200, 0.18);
  --accent: #8a63ff;
  --accent-2: #5d39d6;
  --brand-glow: rgba(93, 57, 214, 0.34);
  --olive: #74d3bc;
  --warn: #f4b860;
  --danger: #ff7d94;
  --user-chat-start: #2b1e63;
  --user-chat-end: #1b123f;
  --chat-user-ink: #f4efff;
  --hero-start: rgba(24, 18, 49, 0.98);
  --hero-end: rgba(12, 10, 28, 0.94);
  --ghost-bg: rgba(20, 16, 40, 0.72);
  --input-bg: rgba(16, 13, 33, 0.9);
  --stack-bg: rgba(17, 14, 34, 0.86);
  --shadow: 0 30px 90px rgba(3, 1, 12, 0.52);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: 'Manrope', sans-serif;
  color: var(--ink);
  background:
    radial-gradient(circle at 22% 8%, var(--bg-overlay-1), transparent 30%),
    radial-gradient(circle at 78% 92%, var(--bg-overlay-2), transparent 36%),
    linear-gradient(180deg, var(--bg) 0%, color-mix(in srgb, var(--bg) 90%, #000 10%) 100%);
  overflow: hidden;
}

button, input, textarea, select { font: inherit; }

.app-shell {
  min-height: 100vh;
  height: 100vh;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  background:
    radial-gradient(circle at 18% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 28%),
    radial-gradient(circle at 86% 100%, color-mix(in srgb, var(--accent-2) 20%, transparent), transparent 24%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg) 94%, #000 6%) 0%, color-mix(in srgb, var(--bg) 86%, #000 14%) 100%);
  overflow: hidden;
  width: 100%;
}

.app-shell.compact {
  grid-template-columns: 104px minmax(0, 1fr);
}

.app-shell.railHidden .chat-layout {
  grid-template-columns: 1fr;
}

.sidebar {
  padding: 28px 20px;
  border-right: 1px solid var(--line);
  background: linear-gradient(180deg, color-mix(in srgb, var(--sidebar) 94%, transparent) 0%, color-mix(in srgb, var(--sidebar) 82%, #000 18%) 100%);
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 0;
  height: 100vh;
}

.sidebar.collapsed .brand-sub,
.sidebar.collapsed .nav-sub,
.sidebar.collapsed .tiny-copy,
.sidebar.collapsed .brand-name,
.sidebar.collapsed .brand-logo-image {
  display: none;
}

.brand { display: flex; align-items: center; gap: 14px; }

.brand-mark {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-2) 55%, #24123f);
  box-shadow: 0 20px 35px var(--brand-glow);
  overflow: hidden;
}

.brand-copy { display: grid; gap: 6px; min-width: 0; }
.brand-logo-image {
  height: 24px;
  width: auto;
  max-width: 150px;
  object-fit: contain;
  filter: brightness(1.05);
}
.brand-icon-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: left center;
  transform: scale(1.15);
}

.brand-name, .brand-sub, .eyebrow, .tiny-label, .nav-sub { margin: 0; }
.brand-name, .topbar h1, .hero-card h2, .panel h3 { font-family: 'Space Grotesk', sans-serif; }
.brand-name { font-size: .92rem; }

.sidebar-stack, .stack-list, .card-grid, .rail { display: grid; gap: 12px; }

.sidebar-card, .nav-item, .panel, .hero-card, .metric-card, .mini-card, .modal-card, .message-card, .composer, .toast {
  border: 1px solid var(--line);
  background: var(--surface);
  backdrop-filter: blur(14px);
  box-shadow: var(--shadow);
  border-radius: 24px;
}

.sidebar-card, .panel, .hero-card, .metric-card, .modal-card { padding: 20px; }

.nav-item {
  text-align: left;
  padding: 12px 14px;
  cursor: pointer;
  transition: .18s;
  color: var(--ink);
  min-height: 62px;
}

.nav-item.active, .nav-item:hover, .stack-item:hover, .primary:hover, .ghost:hover, .danger:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 34%, transparent);
  background: color-mix(in srgb, var(--surface) 82%, var(--accent) 18%);
}

.nav-title { display: block; font-weight: 700; }
.nav-sub, .tiny-copy, .muted, .message-text p { color: var(--muted); }
.tiny-label, .eyebrow { text-transform: uppercase; letter-spacing: .08em; font-size: .68rem; font-weight: 800; }

.workspace {
  padding: 0;
  display: grid;
  gap: 18px;
  min-height: 100vh;
  overflow: auto;
  position: relative;
  width: 100%;
  min-width: 0;
  margin: 0;
}

.workspace.chat-mode {
  height: 100vh;
  overflow: hidden;
}
.topbar, .action-row, .panel-head, .run-head, .inline-input { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.topbar {
  position: sticky;
  top: 0;
  z-index: 6;
  padding: 6px 10px 10px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg) 92%, transparent) 0%, color-mix(in srgb, var(--bg) 70%, transparent) 75%, transparent 100%);
  backdrop-filter: blur(18px);
}
.topbar h1 { margin: 0; font-size: clamp(1.28rem, 1.5vw, 1.7rem); line-height: 1.05; }

.hero-grid {
  display: grid;
  grid-template-columns: minmax(320px, 1.6fr) repeat(3, minmax(120px, .44fr));
  gap: 12px;
  align-items: stretch;
}

.hero-grid.compact-bar {
  grid-auto-rows: minmax(110px, auto);
}

.hero-grid.expanded,
.hero-grid.docked {
  grid-template-columns: minmax(320px, 1.6fr) repeat(3, minmax(120px, .44fr));
}

.hero-card {
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 18%, transparent), transparent 28%),
    linear-gradient(135deg, var(--hero-start), var(--hero-end));
  padding: 16px 18px;
}
.hero-card h2 { font-size: clamp(1.05rem, 1.25vw, 1.55rem); margin: 6px 0 4px; line-height: 1.08; }

.pill-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.pill {
  padding: 7px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
  font-size: .8rem;
  font-weight: 700;
}

.metric-card {
  padding: 14px 16px;
  min-height: 110px;
}

.metric-card strong {
  display: block;
  margin: 8px 0 2px;
  font-size: 1.55rem;
  font-family: 'Space Grotesk', sans-serif;
}
.chat-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  min-height: 0;
  height: calc(100vh - 128px);
  align-items: stretch;
  overflow: hidden;
}
.panel-chat {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 88%, transparent) 0%, color-mix(in srgb, var(--surface) 94%, transparent) 100%);
}
.stage-strip {
  display:grid;
  grid-template-columns: 150px minmax(0,1fr) 150px;
  gap:10px;
  flex: 0 0 auto;
}
.stage-card {
  border:1px solid var(--line);
  background: linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 90%, transparent) 0%, color-mix(in srgb, var(--stack-bg) 94%, transparent) 100%);
  border-radius:18px;
  padding:12px 14px;
  display:grid;
  gap:4px;
}
.stage-card strong { font-size: .84rem; }
.stage-detail strong { font-size: .8rem; line-height: 1.35; }
.context-box { display: grid; gap: 6px; }

.chat-stream {
  flex: 1 1 auto;
  min-height: 220px;
  max-height: 52vh;
  overflow: auto;
  display: grid;
  gap: 14px;
  padding-right: 6px;
  padding-bottom: 8px;
  align-content: start;
}

.message-row.user { display: flex; justify-content: flex-end; }

.message-card { max-width: min(78%, 720px); padding: 12px 14px; }
.message-card.user { background: linear-gradient(135deg, var(--user-chat-start), var(--user-chat-end)); color: var(--chat-user-ink); }
.message-card.nexus_result, .message-card.nexus { background: var(--surface); }
.message-card.nexus_thought { background: color-mix(in srgb, var(--accent) 10%, var(--surface) 90%); border-style: dashed; }
.message-card.nexus_error { background: color-mix(in srgb, var(--danger) 10%, var(--surface) 90%); border-color: color-mix(in srgb, var(--danger) 25%, transparent); }
.message-text { line-height: 1.48; margin-top: 6px; word-break: break-word; font-size: .92rem; }

.composer {
  padding: 14px;
  display: grid;
  gap: 10px;
  flex: 0 0 auto;
  background: color-mix(in srgb, var(--surface-strong) 94%, transparent);
  box-shadow: 0 -16px 34px rgba(6, 4, 14, 0.35);
}
.composer textarea, .mini-card textarea, .mini-card input, .mini-card select, .context-box select, .inline-input input {
  width: 100%;
  border: 1px solid var(--line);
  background: var(--input-bg);
  border-radius: 18px;
  padding: 12px 14px;
  color: var(--ink);
}

.composer textarea, .mini-card textarea { min-height: 92px; resize: vertical; }
.grid-two { display: grid; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: 18px; }
.card-grid { grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
.mini-card { padding: 18px; display: grid; gap: 12px; }
.mini-card.full { grid-column: 1 / -1; }

.stack-item {
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: var(--stack-bg);
  text-decoration: none;
  color: inherit;
}

.rail {
  min-height: 0;
  height: 100%;
  overflow: auto;
  overflow-x: hidden;
  max-width: 320px;
  padding-right: 4px;
  display: grid;
  gap: 12px;
  align-content: start;
}

.topbar-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.compact-metric {
  min-height: 110px;
  padding: 14px 16px;
}

.compact-metric strong {
  margin-top: 8px;
  font-size: 1.5rem;
}

.compact-metric p,
.hero-card .muted {
  margin: 0;
  font-size: .84rem;
  line-height: 1.4;
}

.app-shell.compact .workspace {
  width: 100%;
}

.app-shell.compact .sidebar {
  width: 104px;
  padding-inline: 14px;
}

.app-shell.compact .brand {
  justify-content: center;
}

.app-shell.compact .nav-item,
.app-shell.compact .sidebar-card {
  padding-inline: 12px;
}

.app-shell.railHidden .hero-grid {
  grid-template-columns: minmax(320px, 1.8fr) repeat(3, minmax(120px, .36fr));
}

.app-shell.railHidden .hero-grid.compact-bar {
  grid-template-columns: minmax(320px, 1.8fr) repeat(3, minmax(120px, .36fr));
}

.app-shell.railHidden .chat-layout {
  grid-template-columns: 1fr;
}

.summary-scroll {
  display: grid;
  gap: 10px;
  max-height: none;
  overflow: visible;
}

.summary-hero {
  padding: 14px 16px;
}

.summary-metrics {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.panel,
.metric-card,
.mini-card,
.sidebar-card {
  background: linear-gradient(180deg, rgba(22, 17, 42, 0.92) 0%, rgba(16, 13, 31, 0.9) 100%);
}

.approval-json {
  margin: 0;
  padding: 14px;
  border-radius: 16px;
  background: rgba(9, 8, 18, 0.68);
  border: 1px solid rgba(131, 108, 200, 0.14);
  overflow: auto;
  color: var(--muted);
}

.chat-stream::-webkit-scrollbar,
.rail::-webkit-scrollbar {
  width: 10px;
}

.chat-stream::-webkit-scrollbar-thumb,
.rail::-webkit-scrollbar-thumb {
  background: rgba(138, 99, 255, 0.22);
  border-radius: 999px;
}

.badge {
  padding: 7px 10px;
  border-radius: 999px;
  font-size: .78rem;
  font-weight: 800;
  text-transform: capitalize;
  background: color-mix(in srgb, var(--muted) 18%, transparent);
}

.badge.success, .badge.completed { background: color-mix(in srgb, var(--olive) 20%, transparent); color: var(--olive); }
.badge.warning, .badge.paused, .badge.retry_wait { background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--warn); }
.badge.running, .badge.queued { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); }
.badge.stopped, .badge.error, .badge.failed, .badge.dead_letter, .badge.cancelled { background: color-mix(in srgb, var(--danger) 18%, transparent); color: var(--danger); }

button { border: none; cursor: pointer; }

.primary, .ghost, .danger, .link-btn {
  padding: 10px 14px;
  border-radius: 999px;
  transition: .18s;
}

.primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff7f0;
}

.primary.subtle { background: linear-gradient(135deg, var(--olive), color-mix(in srgb, var(--olive) 70%, #10231d 30%)); }
.ghost { background: var(--ghost-bg); border: 1px solid var(--line); color: var(--ink); }
.danger { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
.link-btn { background: transparent; color: var(--accent); padding: 0; }

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(12, 8, 24, 0.42);
  backdrop-filter: blur(10px);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 20;
}

.modal-card { width: min(980px, 100%); max-height: 90vh; overflow: auto; background: var(--surface-strong); }
.toast { position: fixed; right: 22px; bottom: 22px; padding: 14px 18px; z-index: 30; }
.hidden-input { display: none; }
.mobile-only { display: none; }
.fade-enter-active, .fade-leave-active { transition: opacity .16s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width:1100px) {
  .app-shell, .hero-grid, .chat-layout, .grid-two { grid-template-columns: 1fr; }
  .workspace {
    height: auto;
    overflow: visible;
    width: 100%;
  }
  .panel-chat, .rail {
    height: auto;
    max-height: none;
  }
  .chat-stream,
  .rail {
    min-height: unset;
  }
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: min(320px, 86vw);
    transform: translateX(-105%);
    transition: transform .18s;
    z-index: 25;
  }
  .sidebar.open { transform: translateX(0); }
  .mobile-only { display: inline-flex; }
  .topbar {
    position: static;
    padding-top: 0;
  }
  .chat-layout {
    height: auto;
    overflow: visible;
  }
  .hero-grid.compact-bar,
  .app-shell.railHidden .hero-grid.compact-bar {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
  }
}

@media (max-width:720px) {
  .workspace { padding: 16px; }
  .message-card { max-width: 100%; }
  .topbar, .action-row, .panel-head, .run-head, .inline-input { flex-direction: column; align-items: flex-start; }
  .stage-strip { grid-template-columns: 1fr; }
  .hero-card,
  .metric-card,
  .panel,
  .sidebar-card,
  .composer,
  .message-card {
    border-radius: 20px;
  }
  .brand {
    gap: 10px;
  }
  .brand-logo-image {
    max-width: 118px;
    height: 20px;
  }
  .topbar-actions {
    width: 100%;
    justify-content: stretch;
  }
  .topbar-actions > * {
    width: 100%;
  }
  .composer {
    position: static;
  }
  body {
    overflow: auto;
  }
  .app-shell {
    height: auto;
    overflow: visible;
  }
}
</style>
