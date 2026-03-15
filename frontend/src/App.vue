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
const showOutputs = ref(false)

const chatContainer = ref(null)

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
    
    // Automatically display agent thoughts in the chat to make it feel alive
    if (data.type === 'thought') {
      const lastMsg = chatHistory.value[chatHistory.value.length - 1]
      if (lastMsg.sender === 'nexus_thought') {
         lastMsg.text = data.message // Update existing thought
      } else {
         addChatMessage(data.message, 'nexus_thought')
      }
    } else if (data.type === 'action') {
      const lastMsg = chatHistory.value[chatHistory.value.length - 1]
      if (lastMsg.sender === 'nexus_thought') {
         lastMsg.text += `<br><span class="tool-call">🛠️ Using tool: ${data.name}</span>`
      } else {
         addChatMessage(`<span class="tool-call">🛠️ Using tool: ${data.name}</span>`, 'nexus_thought')
      }
    }

    if (data.type === 'error') {
      endTask(true)
      addChatMessage(`❌ Error: ${data.message}`, 'nexus_error')
    } else if (data.type === 'complete') {
      const finalMsg = logs.value.slice().reverse().find(l => l.type === 'result')?.message || 'Task completed.'
      addChatMessage(finalMsg, 'nexus')
      endTask(false)
      sendNotification('Nexus OS Task Complete', { body: 'Finished processing your request.' })
    } else if (data.type === 'input_requested') {
      isWaitingForInput.value = true
      isWorking.value = false
      taskStatusText.value = 'Waiting for input...'
      taskStatusColor.value = '#d29922'
      addChatMessage(`⚠️ ${data.message}`, 'nexus_warning')
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
  
  let formatted = text
  
  // 1. Handle Images: ![alt](url) or [alt](url) where url ends in image extension
  // Match standard markdown images and standard links that look like images
  const imageRegex = /\[([^\]]+)\]\(([^)]+\.(?:png|jpg|jpeg|webp|gif))\)/gi
  formatted = formatted.replace(imageRegex, (match, alt, url) => {
    return `<div class="chat-image-container">
              <img src="${url}" alt="${alt}" class="chat-image" onclick="window.open('${url}', '_blank')" />
              <a href="${url}" download class="download-overlay">Download Image</a>
            </div>`
  })

  // 2. Handle other files (Standard links)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  formatted = formatted.replace(linkRegex, (match, alt, url) => {
    // If it was already replaced by the image regex, skip it (simple check: does it start with <div)
    if (url.match(/\.(?:png|jpg|jpeg|webp|gif)$/i)) return match
    return `<a href="${url}" target="_blank" class="chat-link" download="${alt}">📄 ${alt}</a>`
  })

  formatted = formatted.replace(/\n/g, '<br>')
  return formatted
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
    socket.emit('user_input', { prompt })
  } else {
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
  taskStatusText.value = isError ? 'Error' : 'Online'
  taskStatusColor.value = isError ? '#ff7b72' : '#3fb950'
}
</script>

<template>
  <div class="app-container">
    <header>
      <div class="brand">
        <h1>Nexus OS</h1>
        <div class="status">
          <span class="status-dot" :style="{ backgroundColor: taskStatusColor, boxShadow: `0 0 8px ${taskStatusColor}` }"></span> 
          {{ taskStatusText }}
        </div>
      </div>
      <button v-if="generatedOutputs.length > 0" class="icon-btn" @click="showOutputs = !showOutputs">
        📂 Files ({{ generatedOutputs.length }})
      </button>
    </header>

    <!-- Overlay for Files -->
    <div v-if="showOutputs" class="outputs-overlay">
      <div class="outputs-header">
        <h3>Generated Files</h3>
        <button class="close-btn" @click="showOutputs = false">✕</button>
      </div>
      <div class="outputs-list">
        <a v-for="file in generatedOutputs" :key="file.name" :href="file.url" target="_blank" class="output-item" download>
          📄 {{ file.name }}
        </a>
      </div>
    </div>

    <!-- Main Chat Area -->
    <main class="chat-history" ref="chatContainer" @click="showOutputs = false">
      <div class="chat-wrapper">
        <div v-for="(msg, idx) in chatHistory" :key="idx" :class="['chat-bubble-container', msg.sender]">
          <div v-if="msg.sender.startsWith('nexus')" class="avatar nexus-avatar">N</div>
          <div :class="['chat-bubble', msg.sender]">
            <span v-html="formatMessage(msg.text)"></span>
          </div>
          <div v-if="msg.sender === 'user'" class="avatar user-avatar">U</div>
        </div>
        <div v-show="isWorking" class="chat-bubble-container nexus_thought">
          <div class="avatar nexus-avatar">N</div>
          <div class="chat-bubble nexus_thought typing-indicator">
            Thinking<span>.</span><span>.</span><span>.</span>
          </div>
        </div>
      </div>
    </main>

    <!-- Input Area -->
    <footer class="input-area">
      <div class="input-container">
        <textarea 
          v-model="promptInput" 
          @keydown.enter.prevent="submitTask"
          :placeholder="isWaitingForInput ? 'Provide the requested info...' : 'Message Nexus OS...'"
          :disabled="isWorking"
          rows="1"
        ></textarea>
        <button @click="submitTask" :disabled="isWorking || !promptInput.trim()" class="send-btn">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
          </svg>
        </button>
      </div>
    </footer>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@600;700&display=swap');

:root {
  --bg-color: #0b0f19;
  --panel-bg: rgba(22, 27, 34, 0.8);
  --border-color: rgba(255, 255, 255, 0.1);
  --text-main: #e2e8f0;
  --text-muted: #94a3b8;
  --accent-primary: #58a6ff;
  --user-bg: #1e3a8a;
  --nexus-bg: #1e293b;
  --input-bg: #0f172a;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Inter', sans-serif;
  background-color: var(--bg-color);
  color: var(--text-main);
  overscroll-behavior-y: none;
}

.app-container {
  height: 100vh;
  height: 100dvh; /* For mobile browsers */
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Header */
header {
  padding: 1rem;
  background: var(--panel-bg);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 10;
}

.brand h1 {
  font-family: 'Outfit', sans-serif;
  font-size: 1.4rem;
  background: linear-gradient(90deg, #58a6ff, #a371f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.status {
  font-size: 0.8rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  margin-top: 4px;
}

.status-dot {
  height: 8px; width: 8px;
  border-radius: 50%;
  margin-right: 6px;
  transition: background-color 0.3s;
}

.icon-btn {
  background: rgba(88, 166, 255, 0.15);
  border: 1px solid rgba(88, 166, 255, 0.3);
  color: var(--accent-primary);
  padding: 0.5rem 0.8rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

/* Outputs Overlay */
.outputs-overlay {
  position: absolute;
  top: 70px; right: 10px;
  width: 300px; max-width: 90vw;
  background: var(--panel-bg);
  backdrop-filter: blur(15px);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  z-index: 20;
  display: flex;
  flex-direction: column;
  max-height: 50vh;
}

.outputs-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.close-btn { background: none; border: none; color: var(--text-muted); font-size: 1.2rem; cursor: pointer; }

.outputs-list {
  padding: 1rem;
  overflow-y: auto;
  display: flex; flexDirection: column; gap: 0.5rem;
}

.output-item {
  color: var(--text-main);
  text-decoration: none;
  padding: 0.8rem;
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  font-size: 0.9rem;
  display: flex; align-items: center;
}

/* Chat Area */
.chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 1rem;
  scroll-behavior: smooth;
  display: flex;
  justify-content: center;
}

.chat-wrapper {
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.chat-bubble-container {
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
  width: 100%;
}

.chat-bubble-container.user { justify-content: flex-end; }
.chat-bubble-container.nexus, .chat-bubble-container.nexus_thought, .chat-bubble-container.nexus_warning, .chat-bubble-container.nexus_error { justify-content: flex-start; }

.avatar {
  width: 30px; height: 30px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem; font-weight: bold; flex-shrink: 0;
}
.nexus-avatar { background: linear-gradient(135deg, #1e3a8a, #a371f7); color: white; }
.user-avatar { background: #334155; color: white; }

.chat-bubble {
  max-width: 85%;
  padding: 0.8rem 1.2rem;
  border-radius: 18px;
  font-size: 0.95rem;
  line-height: 1.5;
  word-wrap: break-word;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.chat-bubble.user { background: var(--user-bg); border-bottom-right-radius: 4px; }
.chat-bubble.nexus { background: var(--nexus-bg); border-bottom-left-radius: 4px; border: 1px solid rgba(255,255,255,0.05); }
.chat-bubble.nexus_thought { background: transparent; color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0; border: none; }
.chat-bubble.nexus_warning { background: rgba(210, 153, 34, 0.15); border: 1px solid #d29922; color: #ebd197; border-bottom-left-radius: 4px; }
.chat-bubble.nexus_error { background: rgba(255, 123, 114, 0.15); border: 1px solid #ff7b72; color: #ff7b72; border-bottom-left-radius: 4px; }

.tool-call { color: #a371f7; font-family: monospace; font-size: 0.8rem; }
.chat-link { 
  color: var(--accent-primary); 
  text-decoration: none; 
  background: rgba(88, 166, 255, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid rgba(88, 166, 255, 0.2);
  display: inline-block;
  margin-top: 5px;
}

.chat-image-container {
  margin-top: 10px;
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  background: #000;
  max-width: 100%;
}

.chat-image {
  display: block;
  max-width: 100%;
  height: auto;
  cursor: pointer;
  transition: opacity 0.2s;
}

.chat-image:hover { opacity: 0.9; }

.download-overlay {
  position: absolute;
  bottom: 8px; right: 8px;
  background: rgba(0,0,0,0.7);
  color: white;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  text-decoration: none;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,0.2);
}

/* Input Area */
.input-area {
  padding: 1rem;
  background: var(--bg-color);
  display: flex;
  justify-content: center;
}

.input-container {
  width: 100%;
  max-width: 800px;
  display: flex;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 24px;
  padding: 0.5rem 1rem;
  align-items: center;
  transition: border-color 0.2s;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

.input-container:focus-within { border-color: var(--accent-primary); }

textarea {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-main);
  font-family: inherit;
  font-size: 1rem;
  resize: none;
  height: 40px;
  line-height: 40px;
  outline: none;
}

.send-btn {
  background: var(--accent-primary);
  border: none;
  border-radius: 50%;
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  color: white;
  cursor: pointer;
  transition: transform 0.2s;
}

.send-btn:hover:not(:disabled) { transform: scale(1.05); }
.send-btn:disabled { background: #334155; color: #64748b; cursor: not-allowed; }

.typing-indicator span { animation: blink 1.4s infinite both; }
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes blink { 0% { opacity: 0.2; } 20% { opacity: 1; } 100% { opacity: 0.2; } }
</style>
