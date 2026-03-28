<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  activeMissionMode: { type: String, required: true },
  chatHistory: { type: Array, required: true },
  clients: { type: Array, required: true },
  currentBlocker: { type: Object, default: null },
  currentEngine: { type: String, required: true },
  currentStage: { type: Object, required: true },
  engineThemeClass: { type: String, required: true },
  fileInputId: { type: String, default: 'chat-file-input' },
  formatMessage: { type: Function, required: true },
  isVoiceListening: { type: Boolean, default: false },
  isWorking: { type: Boolean, default: false },
  llmStatus: { type: Object, required: true },
  missionStatus: { type: String, required: true },
  modeRoutingHint: { type: String, required: true },
  pendingApprovalSummary: { type: Object, default: null },
  promptInput: { type: String, required: true },
  selectedClientForChat: { type: String, default: '' },
  suggestedReplyChips: { type: Array, required: true }
})

const emit = defineEmits([
  'file-upload',
  'reply-chip',
  'stop-voice',
  'submit',
  'terminate',
  'toggle-voice',
  'update:promptInput',
  'update:selectedClientForChat'
])

const internalFileInput = ref(null)
const chatContainer = ref(null)

const promptModel = computed({
  get: () => props.promptInput,
  set: (value) => emit('update:promptInput', value)
})

const selectedClientModel = computed({
  get: () => props.selectedClientForChat,
  set: (value) => emit('update:selectedClientForChat', value)
})

function triggerFilePicker() {
  internalFileInput.value?.click()
}

defineExpose({
  scrollToBottom() {
    if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
})
</script>

<template>
  <div class="panel panel-chat">
    <div class="panel-head">
      <div>
        <span class="tiny-label">Live mission</span>
        <h3>Boss stream</h3>
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
      <div class="context-box">
        <label>Context</label>
        <v-select
          v-model="selectedClientModel"
          :items="[{ title: 'System Default', value: '' }, ...clients.map((client) => ({ title: client.name, value: client.id }))]"
          item-title="title"
          item-value="value"
          density="comfortable"
          variant="outlined"
          hide-details
        />
      </div>
    </div>

    <div class="mini-card engine-card" :class="engineThemeClass">
      <div class="run-head">
        <strong>Current engine</strong>
        <span class="badge success">{{ llmStatus.provider }}</span>
      </div>
      <p class="muted">{{ currentEngine }}</p>
      <p class="muted">LLM: {{ llmStatus.provider }} / {{ llmStatus.model }}</p>
      <p class="muted">Mode routing: {{ modeRoutingHint }}</p>
    </div>

    <div v-if="pendingApprovalSummary" class="mini-card approval-ready-card">
      <div class="run-head">
        <strong>Approval Ready</strong>
        <span class="badge warning">{{ pendingApprovalSummary.currentMode }} -> {{ pendingApprovalSummary.nextMode }}</span>
      </div>
      <p class="muted">Nexus is requesting approval for <strong>{{ pendingApprovalSummary.tool }}</strong>.</p>
      <p class="muted">Likely engine: {{ pendingApprovalSummary.likelyEngine }}</p>
      <p class="muted">Estimated cost band: {{ pendingApprovalSummary.estimatedCostBand }}</p>
      <div v-if="pendingApprovalSummary.estimatedTools.length" class="pill-row">
        <span v-for="tool in pendingApprovalSummary.estimatedTools" :key="tool" class="pill">{{ tool }}</span>
      </div>
      <div class="action-row">
        <v-btn class="primary subtle" rounded="pill" @click="emit('reply-chip', 'yes')">Approve</v-btn>
        <v-btn class="ghost" rounded="pill" variant="outlined" @click="emit('reply-chip', 'no')">Reject</v-btn>
      </div>
      <div class="stack-item">
        <strong>Published Gemini project limits</strong>
        <p class="muted">Reference only. Gemini 2.5 Flash free tier is typically 10 RPM, 250,000 TPM, and 250 RPD at the project level.</p>
        <p class="muted">These limits are shared across the project and may change by model or account tier.</p>
      </div>
      <div class="stack-item">
        <strong>Estimated remaining today</strong>
        <p class="muted">Use Nexus-tracked Gemini calls and tokens as an estimate against published project limits.</p>
        <p class="muted">Verify exact project quota in Google AI Studio or Google Cloud if needed.</p>
      </div>
      <div class="stack-item">
        <strong>Published shared project limits</strong>
        <p class="muted">Gemini free-tier limits apply at the project level, not as isolated per-client quotas.</p>
      </div>
      <div class="stack-item">
        <strong>Estimated remaining after this client</strong>
        <p class="muted">This is an approximation based on Nexus-tracked client usage. Other clients and tools may also consume the same project quota.</p>
      </div>
    </div>

    <div v-if="currentBlocker" class="mini-card">
      <div class="run-head">
        <strong>{{ currentBlocker.title }}</strong>
        <span class="badge warning">Action needed</span>
      </div>
      <p class="muted">{{ currentBlocker.detail }}</p>
    </div>

    <div v-if="suggestedReplyChips.length" class="chip-row">
      <v-btn
        v-for="chip in suggestedReplyChips"
        :key="chip.label + chip.value"
        class="chip-button"
        rounded="pill"
        variant="outlined"
        @click="emit('reply-chip', chip.value)"
      >
        {{ chip.label }}
      </v-btn>
    </div>

    <div ref="chatContainer" class="chat-stream">
      <div v-for="(msg, index) in chatHistory" :key="index" class="message-row" :class="msg.sender">
        <div class="message-card" :class="msg.sender">
          <span class="tiny-label">{{ msg.sender.startsWith('nexus') ? 'Nexus' : 'Boss' }}</span>
          <div class="message-text" v-html="formatMessage(msg.text)"></div>
        </div>
      </div>
    </div>

    <div class="composer">
      <div class="action-row">
        <v-btn class="ghost" rounded="pill" variant="outlined" @click="triggerFilePicker">Attach File</v-btn>
        <v-btn :class="isVoiceListening ? 'danger' : 'ghost'" rounded="pill" :variant="isVoiceListening ? 'flat' : 'outlined'" @click="emit(isVoiceListening ? 'stop-voice' : 'toggle-voice')">
          {{ isVoiceListening ? 'Listening...' : 'Voice' }}
        </v-btn>
        <input :id="fileInputId" ref="internalFileInput" type="file" class="hidden-input" @change="emit('file-upload', $event)" />
      </div>
      <v-textarea
        v-model="promptModel"
        placeholder="Describe the mission, expected result, and constraints."
        variant="outlined"
        auto-grow
        rows="4"
        hide-details
        @keydown.enter.exact.prevent="emit('submit')"
      ></v-textarea>
      <div class="action-row">
        <v-btn v-if="isWorking || missionStatus === 'paused'" class="danger" rounded="pill" @click="emit('terminate')">Stop</v-btn>
        <v-btn v-else class="primary" rounded="pill" @click="emit('submit')">
          {{ String(activeMissionMode || '').toLowerCase() === 'chat' ? 'Send' : 'Launch' }}
        </v-btn>
      </div>
    </div>
  </div>
</template>
