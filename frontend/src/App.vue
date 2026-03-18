<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { io } from 'socket.io-client'

const socket = io() // connects to same host

const logs = ref([])
const chatHistory = ref([
  { 
    sender: 'nexus', 
    text: 'Nexus OS is fully operational. What is the mission today, Boss?'
  }
])

const promptInput = ref('')
const isWorking = ref(false)
const isWaitingForInput = ref(false)
const taskStatusText = ref('Idle')
const taskStatusColor = ref('#8b949e')
const generatedOutputs = ref([])
const showOutputs = ref(false)
const fileInput = ref(null)
const isUploading = ref(false)
const isDragging = ref(false)
const showSplash = ref(true)

onMounted(() => {
  // Hide splash after 3 seconds
  setTimeout(() => {
    showSplash.value = false
  }, 3000)
})

const triggerFileUpload = () => {
  fileInput.value.click()
}

const handleFileUpload = async (eventOrFiles) => {
  let files;
  if (eventOrFiles instanceof DragEvent) {
    files = eventOrFiles.dataTransfer.files;
  } else if (eventOrFiles?.target?.files) {
    files = eventOrFiles.target.files;
  } else {
    files = eventOrFiles; // direct file array
  }
  
  const file = files[0]
  if (!file) return

  isUploading.value = true
  const formData = new FormData()
  formData.append('file', file)

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    })
    
    const text = await response.text()
    let data;
    try {
      data = JSON.parse(text)
    } catch (e) {
      throw new Error(`Invalid server response (not JSON): ${text.substring(0, 100)}`)
    }

    if (response.ok) {
      addChatMessage(`📎 File uploaded: **${data.originalName}**\nPath: \`${data.path}\` (You can now use this file in your mission instructions)`, 'user')
      sendNotification('Upload Success', { body: `File ${data.originalName} is now available.` })
    } else {
      addChatMessage(`❌ Upload failed: ${data.error}`, 'nexus_error')
    }
  } catch (error) {
    addChatMessage(`❌ Upload error: ${error.message}`, 'nexus_error')
  } finally {
    isUploading.value = false
    if (eventOrFiles?.target) eventOrFiles.target.value = '' // Reset input
  }
}

const onDragOver = (e) => {
  e.preventDefault()
  isDragging.value = true
}

const onDragLeave = (e) => {
  e.preventDefault()
  isDragging.value = false
}

const onDrop = (e) => {
  e.preventDefault()
  isDragging.value = false
  handleFileUpload(e)
}

const chatContainer = ref(null)

const notificationPermission = ref(Notification.permission)

const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return
  const result = await Notification.requestPermission()
  notificationPermission.value = result
}

const sendNotification = async (title, options) => {
  if (!('serviceWorker' in navigator)) {
    if (Notification.permission === 'granted') new Notification(title, options)
    return
  }
  
  const registration = await navigator.serviceWorker.ready
  if (registration && Notification.permission === 'granted') {
    registration.showNotification(title, {
       icon: '/pwa-192x192.png',
       badge: '/favicon.svg',
       ...options
    })
  }
}

onMounted(() => {
  // requestNotificationPermission() // Disabled auto-request for iOS compliance

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
  <div 
    class="app-container"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- Drag over overlay -->
    <div v-if="isDragging" class="dropzone-overlay">
      <div class="dropzone-content">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"></path>
        </svg>
        <p>Drop to upload to Nexus OS</p>
      </div>
    </div>

    <!-- Animated Splash Screen -->
    <transition name="fade">
      <div v-if="showSplash" class="splash-screen">
        <div class="splash-content">
          <img src="/pwa-512x512.png" alt="Nexus OS Logo" class="splash-logo" />
          <div class="splash-loader">
            <div class="loader-bar"></div>
          </div>
          <p class="splash-text">Initializing Nexus Intelligence...</p>
        </div>
      </div>
    </transition>

    <header>
      <div class="brand">
        <img src="/pwa-192x192.png" alt="Logo" class="header-logo" />
        <h1>Nexus OS</h1>
        <div class="status">
          <span class="status-dot" :style="{ backgroundColor: taskStatusColor, boxShadow: `0 0 8px ${taskStatusColor}` }"></span> 
          {{ taskStatusText }}
        </div>
      </div>
      <div class="header-actions">
        <button v-if="notificationPermission !== 'granted'" class="icon-btn notify-btn" @click="requestNotificationPermission">
          🔔 Enable Alerts
        </button>
        <button v-if="generatedOutputs.length > 0" class="icon-btn" @click="showOutputs = !showOutputs">
          📂 Files ({{ generatedOutputs.length }})
        </button>
      </div>
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
        <input 
          type="file" 
          ref="fileInput" 
          style="display: none" 
          @change="handleFileUpload"
        />
        <button 
          class="upload-btn" 
          @click="triggerFileUpload" 
          :disabled="isWorking || isUploading"
          title="Upload file"
        >
          <svg v-if="!isUploading" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M16.5 6c-2.48 0-4.5 2.02-4.5 4.5v7c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5v-7c0-.55-.45-1-1-1s-1 .45-1 1v7h-1.5v-7c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v7c0 2.21-1.79 4-4 4s-4-1.79-4-4v-7c0-3.31 2.69-6 6-6s6 2.69 6 6v10.5h-1.5V10.5c0-2.48-2.02-4.5-4.5-4.5z"></path>
          </svg>
          <div v-else class="upload-loader"></div>
        </button>
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

/* Splash Screen */
.splash-screen {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--bg-color);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.splash-content {
  text-align: center;
}

.splash-logo {
  width: 180px;
  height: 180px;
  object-fit: contain;
  margin-bottom: 2.5rem;
  animation: logoPulse 2s infinite ease-in-out;
  border-radius: 40px;
}

.splash-loader {
  width: 240px;
  height: 4px;
  background: rgba(255,255,255,0.05);
  border-radius: 2px;
  margin: 0 auto 1.5rem;
  overflow: hidden;
}

.loader-bar {
  width: 0%;
  height: 100%;
  background: linear-gradient(90deg, var(--accent-primary), #a371f7);
  animation: loadProgress 2.5s ease-out forwards;
}

.splash-text {
  color: var(--text-muted);
  font-size: 0.8rem;
  letter-spacing: 3px;
  text-transform: uppercase;
  font-weight: 500;
}

@keyframes logoPulse {
  0% { transform: scale(1); filter: drop-shadow(0 0 0px var(--accent-primary)); }
  50% { transform: scale(1.05); filter: drop-shadow(0 0 30px rgba(88, 166, 255, 0.4)); }
  100% { transform: scale(1); filter: drop-shadow(0 0 0px var(--accent-primary)); }
}

@keyframes loadProgress {
  0% { width: 0; }
  100% { width: 100%; }
}

.fade-leave-active { transition: opacity 0.8s ease; }
.fade-leave-to { opacity: 0; }

/* Dropzone Overlay */
.dropzone-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(88, 166, 255, 0.1);
  backdrop-filter: blur(8px);
  border: 2px dashed var(--accent-primary);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  animation: fadeIn 0.2s ease-out;
}

.dropzone-content {
  text-align: center;
  color: var(--accent-primary);
}

.dropzone-content p {
  margin-top: 1rem;
  font-weight: 600;
  font-size: 1.2rem;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.brand { display: flex; align-items: center; }

.header-logo {
  height: 32px;
  width: 32px;
  margin-right: 12px;
  border-radius: 8px;
  animation: miniPulse 4s infinite ease-in-out;
}

@keyframes miniPulse {
  0%, 100% { transform: scale(1); filter: brightness(1); }
  50% { transform: scale(1.1); filter: brightness(1.2) drop-shadow(0 0 5px var(--accent-primary)); }
}

/* Status */
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

.upload-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.upload-btn:hover:not(:disabled) { color: var(--accent-primary); }
.upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.upload-loader {
  width: 18px;
  height: 18px;
  border: 2px solid var(--text-muted);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.typing-indicator span { animation: blink 1.4s infinite both; }
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes blink { 0% { opacity: 0.2; } 20% { opacity: 1; } 100% { opacity: 0.2; } }
</style>
