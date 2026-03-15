<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { io } from 'socket.io-client'

const socket = io() // connects to same host

const logs = ref([])
const chatHistory = ref([
  { 
    sender: 'nexus', 
    text: 'Welcome to Nexus OS. I am fully operational and capable of advanced planning, web browsing, code generation, and visual design. How can I help you today?'
  }
])

const promptInput = ref('')
const isWorking = ref(false)
const isWaitingForInput = ref(false)
const taskStatusText = ref('Idle')
const taskStatusColor = ref('#8b949e')
const generatedOutputs = ref([])

const chatContainer = ref(null)
const logContainerRef = ref(null)

// Push Notifications Setup
const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'denied' && Notification.permission !== 'granted') {
    await Notification.requestPermission()
  }
}

const sendNotification = (title, options) => {
  if (('Notification' in window) && Notification.permission === 'granted') {
    new Notification(title, options)
  }
}

onMounted(() => {
  requestNotificationPermission()

  socket.on('nexus_log', (data) => {
    logs.value.push(data)
    scrollToBottom(logContainerRef)

    if (data.type === 'error') {
      endTask(true)
    } else if (data.type === 'complete') {
      const finalMsg = logs.value.slice().reverse().find(l => l.type === 'thought')?.message || 'Task completed.'
      addChatMessage(finalMsg, 'nexus')
      endTask(false)
      sendNotification('Nexus OS Task Complete', { body: finalMsg })
    } else if (data.type === 'input_requested') {
      isWaitingForInput.value = true
      isWorking.value = false
      taskStatusText.value = 'Waiting for your input...'
      taskStatusColor.value = '#d29922'
      addChatMessage(data.message, 'nexus')
      sendNotification('Nexus OS Requires Input', { body: data.message })
    }
  })

  socket.on('outputs_list', (data) => {
    generatedOutputs.value = data.files || []
  })
  
  socket.emit('get_outputs')
})

const scrollToBottom = async (elementRef) => {
  await nextTick()
  if (elementRef.value) {
    elementRef.value.scrollTop = elementRef.value.scrollHeight
  }
}

const addChatMessage = (text, sender) => {
  chatHistory.value.push({ text, sender })
  scrollToBottom(chatContainer)
}

const formatMessage = (text) => {
  if (!text) return ''
  // Format markdown links
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="chat-link">$1</a>')
}

const submitTask = () => {
  const prompt = promptInput.value.trim()
  if (!prompt || isWorking.value) return

  addChatMessage(prompt, 'user')
  promptInput.value = ''

  if (isWaitingForInput.value) {
    isWaitingForInput.value = false
    isWorking.value = true
    taskStatusText.value = 'Processing...'
    taskStatusColor.value = '#58a6ff'
    
    // Resume task
    socket.emit('user_input', { prompt })
  } else {
    // New task
    logs.value = []
    isWorking.value = true
    taskStatusText.value = 'Processing...'
    taskStatusColor.value = '#58a6ff'
    
    socket.emit('start_task', { prompt })
  }
}

const endTask = (isError) => {
  isWorking.value = false
  isWaitingForInput.value = false
  taskStatusText.value = isError ? 'Error' : 'Idle'
  taskStatusColor.value = isError ? '#ff7b72' : '#8b949e'
}
</script>

<template>
  <div class="app-container">
    <header>
      <h1>Nexus OS</h1>
      <div class="status">
        <span :class="['status-dot', { active: true }]"></span> System Online
      </div>
    </header>

    <div class="workspace">
      <!-- Logs Panel -->
      <div class="panel logs-panel">
        <div class="panel-header">
          AGENTIC EXECUTION LOGS
          <span class="task-status" :style="{ color: taskStatusColor }">{{ taskStatusText }}</span>
        </div>
        <div class="log-container" ref="logContainerRef">
          <div v-if="logs.length === 0" class="empty-state">
            Nexus OS initialized. Awaiting commands.
          </div>
          <div v-for="(log, idx) in logs" :key="idx" class="log-entry">
            <template v-if="log.type === 'start'">
              <span class="log-start">⚡ {{ log.message }}</span>
            </template>
            <template v-else-if="log.type === 'step'">
              <div class="log-step">{{ log.message }}</div>
            </template>
            <template v-else-if="log.type === 'thought'">
              <span class="tag tag-thought">THOUGHT</span>
              <span class="log-thought">{{ log.message }}</span>
            </template>
            <template v-else-if="log.type === 'action'">
              <span class="tag tag-action">TOOL CALL</span>
              <span class="log-action">{{ log.name }}</span>
              <div class="log-args">Args: {{ JSON.stringify(log.args) }}</div>
            </template>
            <template v-else-if="log.type === 'result'">
              <span class="tag tag-result">RESULT</span>
              <div class="log-result">{{ log.message }}</div>
            </template>
            <template v-else-if="log.type === 'error'">
              <span class="log-error">❌ {{ log.message }}</span>
            </template>
            <template v-else-if="log.type === 'complete'">
              <div class="log-complete">✓ {{ log.message }}</div>
            </template>
            <template v-else-if="log.type === 'input_requested'">
              <div class="log-input-req">⚠️ {{ log.message }}</div>
            </template>
            <template v-else>
              {{ log.message || JSON.stringify(log) }}
            </template>
          </div>
        </div>
      </div>

      <!-- Right Column: Outputs and Chat -->
      <div class="right-column">
        <!-- Outputs Panel -->
        <div v-if="generatedOutputs.length > 0" class="panel outputs-panel">
          <div class="panel-header">TASK OUTPUTS</div>
          <div class="outputs-list">
            <a v-for="file in generatedOutputs" :key="file.name" :href="file.url" target="_blank" class="output-item">
              📄 {{ file.name }}
            </a>
          </div>
        </div>

        <!-- Chat Panel -->
        <div class="panel chat-panel">
          <div class="panel-header">USER INTERFACE</div>
          <div class="chat-history" ref="chatContainer">
            <div v-for="(msg, idx) in chatHistory" :key="idx" :class="['chat-msg', msg.sender]">
              <span v-html="formatMessage(msg.text)"></span>
            </div>
          </div>

          <div v-show="isWorking" class="typing-indicator">Nexus OS is working...</div>

          <div class="input-area">
            <div :class="['input-container', { focus: true }]">
              <textarea 
                v-model="promptInput" 
                @keydown.enter.prevent="submitTask"
                :placeholder="isWaitingForInput ? 'Reply to Nexus OS...' : 'Give me a task... (Press Enter to send)'"
                :disabled="isWorking"
              ></textarea>
              <button @click="submitTask" :disabled="isWorking || !promptInput.trim()">SEND</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@600;700&display=swap');

:root {
  --bg-color: #0d1117;
  --panel-bg: rgba(22, 27, 34, 0.7);
  --border-color: rgba(255, 255, 255, 0.1);
  --text-main: #c9d1d9;
  --text-muted: #8b949e;
  --accent-primary: #58a6ff;
  --accent-secondary: #ff7b72;
  --accent-success: #3fb950;
  --accent-warning: #d29922;
  --input-bg: #010409;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', sans-serif;
  background-color: var(--bg-color);
  color: var(--text-main);
  background-image: radial-gradient(circle at top right, rgba(88, 166, 255, 0.05), transparent 40%),
                    radial-gradient(circle at bottom left, rgba(163, 113, 247, 0.05), transparent 40%);
}

.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

header {
  padding: 1rem 2rem;
  background: var(--panel-bg);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 10;
}

header h1 {
  font-family: 'Outfit', sans-serif;
  font-size: 1.5rem;
  background: linear-gradient(90deg, #58a6ff, #a371f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.status {
  font-size: 0.85rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
}

.status-dot {
  height: 10px;
  width: 10px;
  background-color: var(--accent-success);
  border-radius: 50%;
  margin-right: 8px;
  box-shadow: 0 0 8px var(--accent-success);
}

.workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 1.5rem;
  gap: 1.5rem;
}

.panel {
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

.panel-header {
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  justify-content: space-between;
  letter-spacing: 0.5px;
}

.logs-panel {
  flex: 1.5;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  scroll-behavior: smooth;
}

.empty-state {
  color: var(--text-muted);
  text-align: center;
  margin-top: 2rem;
  font-style: italic;
}

.log-entry {
  margin-bottom: 0.8rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
  animation: fadeIn 0.3s ease;
}

.log-entry:last-child {
  border-bottom: none;
}

.tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  margin-right: 8px;
  background: rgba(255, 255, 255, 0.1);
}

.tag-thought { background: rgba(163, 113, 247, 0.2); color: #a371f7; }
.tag-action { background: rgba(210, 153, 34, 0.2); color: var(--accent-warning); }
.tag-result { background: rgba(201, 209, 217, 0.1); }

.log-start { color: var(--accent-primary); font-weight: bold; }
.log-step { color: var(--text-muted); margin-top: 1rem; }
.log-thought { color: #a371f7; }
.log-action { color: var(--accent-warning); font-weight: 500;}
.log-args { color: #8b949e; font-size: 0.8rem; margin-top: 4px; }
.log-result { color: var(--text-main); padding-left: 1rem; border-left: 2px solid var(--border-color); margin-top: 5px; white-space: pre-wrap; }
.log-error { color: var(--accent-secondary); font-weight: bold; }
.log-complete { color: var(--accent-success); font-weight: bold; margin-top: 1rem; }
.log-input-req { color: var(--accent-warning); font-weight: bold; margin-top: 1rem; }

.right-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 450px;
}

.outputs-panel {
  max-height: 200px;
}

.outputs-list {
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.output-item {
  color: var(--accent-primary);
  text-decoration: none;
  padding: 0.5rem;
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.05);
  transition: all 0.2s;
  font-size: 0.9rem;
}

.output-item:hover {
  background: rgba(88, 166, 255, 0.1);
  border-color: rgba(88, 166, 255, 0.3);
}

.chat-panel {
  flex: 1;
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  scroll-behavior: smooth;
}

.chat-msg {
  max-width: 85%;
  padding: 0.8rem 1rem;
  border-radius: 12px;
  line-height: 1.5;
  font-size: 0.95rem;
  animation: fadeIn 0.3s ease;
}

.chat-msg.user {
  align-self: flex-end;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  border-bottom-right-radius: 2px;
}

.chat-msg.nexus {
  align-self: flex-start;
  background: rgba(88, 166, 255, 0.1);
  border: 1px solid rgba(88, 166, 255, 0.2);
  color: #c9d1d9;
  border-bottom-left-radius: 2px;
}

.chat-link {
  color: var(--accent-primary);
  font-weight: 500;
  text-decoration: underline;
}

.input-area {
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid var(--border-color);
}

.input-container {
  display: flex;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.input-container:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 1px var(--accent-primary);
}

textarea {
  flex: 1;
  background: transparent;
  border: none;
  padding: 1rem;
  color: var(--text-main);
  font-family: inherit;
  font-size: 0.95rem;
  resize: none;
  height: 60px;
  outline: none;
}

textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button {
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-left: 1px solid var(--border-color);
  padding: 0 1.5rem;
  color: var(--accent-primary);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

button:hover:not(:disabled) {
  background: rgba(88, 166, 255, 0.15);
}

button:disabled {
  color: var(--text-muted);
  cursor: not-allowed;
}

.typing-indicator {
  padding: 0.5rem 1.5rem;
  color: var(--accent-primary);
  font-size: 0.85rem;
  font-style: italic;
  animation: pulse 1.5s infinite;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}
</style>
