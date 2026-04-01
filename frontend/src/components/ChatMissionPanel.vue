<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  missionModeOverride: { type: String, required: true },
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
  suggestedReplyChips: { type: Array, required: true },
  uploadedContextFiles: { type: Array, default: () => [] },
  missionSummary: { type: Object, default: () => ({}) },
  missionTrace: { type: Array, default: () => [] },
  outputFiles: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'file-upload',
  'reply-chip',
  'requeue-job',
  'retry-job',
  'stop-voice',
  'submit',
  'terminate',
  'toggle-voice',
  'update:missionModeOverride',
  'update:promptInput',
  'update:selectedClientForChat'
])

const internalFileInput = ref(null)
const chatContainer = ref(null)
const isApprovalExpanded = ref(false)
const areMissionDetailsHidden = ref(true)
const areResultsVisible = ref(false)
const isTraceVisible = ref(false)

const promptModel = computed({
  get: () => props.promptInput,
  set: (value) => emit('update:promptInput', value)
})

const selectedClientModel = computed({
  get: () => props.selectedClientForChat,
  set: (value) => emit('update:selectedClientForChat', value)
})

const missionModeModel = computed({
  get: () => props.missionModeOverride,
  set: (value) => emit('update:missionModeOverride', value)
})

const missionType = computed(() => {
  const activeRun = props.missionSummary?.activeRun
  const latestUser = [...props.chatHistory].reverse().find((msg) => msg.sender === 'user')
  const prompt = String(activeRun?.prompt || latestUser?.text || '').toLowerCase()
  if (prompt.includes('banner') || prompt.includes('image') || prompt.includes('video')) return 'Creative generation'
  if (prompt.includes('quote') || prompt.includes('invoice') || prompt.includes('finance')) return 'Finance workflow'
  if (prompt.includes('post') || prompt.includes('campaign') || prompt.includes('marketing')) return 'Marketing workflow'
  if (prompt.includes('build') || prompt.includes('code') || prompt.includes('app')) return 'Build workflow'
  return 'Mission workflow'
})

const missionStatusLabel = computed(() => {
  if (props.pendingApprovalSummary) return 'Approval needed'
  if (props.currentBlocker) return 'Waiting for input'
  if (props.missionStatus === 'active') return 'In progress'
  if (props.missionStatus === 'paused') return 'Awaiting Boss'
  return 'Ready'
})

const activeMissionDomainLabel = computed(() => {
  const value = String(props.missionSummary?.activeMissionDomain || '').toLowerCase()
  if (!value) return 'General operations'
  if (value === 'media') return 'Creative studio'
  if (value === 'marketing') return 'Digital marketing'
  if (value === 'development') return 'Development'
  if (value === 'commercial') return 'Quotations & finance'
  if (value === 'communications') return 'Client communications'
  if (value === 'research') return 'Research & browser ops'
  return value.charAt(0).toUpperCase() + value.slice(1)
})

const activeArtifact = computed(() => props.missionSummary?.currentMissionArtifact || null)
const queuedAction = computed(() => Array.isArray(props.missionSummary?.pendingActionChain) ? props.missionSummary.pendingActionChain[0] || null : null)
const latestPublishedTarget = computed(() => Array.isArray(props.missionSummary?.lastPublishedTargets) ? props.missionSummary.lastPublishedTargets[0] || null : null)
const missionTaskStack = computed(() => Array.isArray(props.missionSummary?.missionTaskStack) ? props.missionSummary.missionTaskStack.slice(0, 4) : [])
const bossTaskExamples = computed(() => {
  if (String(props.missionSummary?.activeMissionDomain || '').toLowerCase() === 'marketing') {
    return ['Use this image and prepare Instagram + Facebook drafts', 'Update the caption and repost for LinkedIn', 'Stop after draft and ask my approval']
  }
  if (String(props.missionSummary?.activeMissionDomain || '').toLowerCase() === 'development') {
    return ['Continue this feature and show me the changed files', 'Fix the bug and stop before risky refactors', 'Now switch to the quote module and prepare pricing']
  }
  return ['Create, then stop for approval before publishing', 'Modify the current output and continue', 'Switch task but keep the current artifact in memory']
})

const bossFollowUpExamples = computed(() => ([
  'Delete this post',
  'Use the same creative for LinkedIn',
  'Send the latest quote now',
  'Update this caption and repost',
  'Continue from the last artifact'
]))

const retryableJobs = computed(() => {
  const jobs = Array.isArray(props.missionSummary?.queue?.jobs) ? props.missionSummary.queue.jobs : []
  return jobs.filter((job) => ['dead_letter', 'cancelled', 'failed', 'retry_wait'].includes(job.status)).slice(0, 3)
})

const bossCommandPacks = computed(() => ([
  {
    title: 'Digital Marketing',
    commands: [
      'Create 3 ad creatives for this offer, then stop for approval before publishing.',
      'Write the LinkedIn post, then publish only after I approve the final copy.',
      'Generate the reel, then prepare Meta + X publishing as separate next steps.'
    ]
  },
  {
    title: 'Design Studio',
    commands: [
      'Design a hero banner and keep the source artifact active for revisions.',
      'Create logo options, show me the best 3, then refine the selected one.',
      'Generate a product poster and then adapt the same concept into a square social creative.'
    ]
  },
  {
    title: 'Development',
    commands: [
      'Fix this bug, show me the changed files, and stop before any risky refactor.',
      'Build this feature in small steps and keep the latest code artifact active.',
      'After the code task, switch to quotation and prepare a client estimate for the same work.'
    ]
  }
]))

function isRenderableResult(file) {
  const url = String(file?.url || '')
  const name = String(file?.name || '')
  if (!url) return false
  return /(\.png|\.jpe?g|\.gif|\.webp|\.svg|\.mp4|\.webm|\.ogg|\.mov|\.pdf)(\?.*)?$/i.test(url) ||
    /(\.png|\.jpe?g|\.gif|\.webp|\.svg|\.mp4|\.webm|\.ogg|\.mov|\.pdf)$/i.test(name)
}

const resultFiles = computed(() => (
  Array.isArray(props.outputFiles)
    ? props.outputFiles.filter(isRenderableResult).slice(0, 4)
    : []
))

const traceItems = computed(() => (
  Array.isArray(props.missionTrace)
    ? props.missionTrace.slice(-40).reverse()
    : []
))

function triggerFilePicker() {
  internalFileInput.value?.click()
}

function handleDrop(event) {
  const files = Array.from(event.dataTransfer?.files || [])
  if (files.length) emit('file-upload', files)
}

function handlePaste(event) {
  const files = Array.from(event.clipboardData?.files || [])
  if (files.length) emit('file-upload', files)
}

defineExpose({
  scrollToBottom() {
    if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
})
</script>

<template>
  <div class="panel panel-chat">
    <div class="chat-top-stack">
      <div class="panel-head">
        <div>
          <span class="tiny-label">Live mission</span>
          <h3>Boss stream</h3>
        </div>
        <div class="panel-head-actions">
          <div class="stage-strip compact-stage-strip">
            <div class="stage-card compact-stage-card">
              <span class="tiny-label">Stage</span>
              <strong>{{ currentStage.label }}</strong>
            </div>
            <div class="stage-card compact-stage-card stage-detail">
              <span class="tiny-label">Status</span>
              <strong>{{ currentStage.detail }}</strong>
            </div>
            <div class="stage-card compact-stage-card">
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
          <v-btn class="ghost details-toggle" rounded="pill" variant="outlined" size="small" @click="areMissionDetailsHidden = !areMissionDetailsHidden">
            {{ areMissionDetailsHidden ? 'Show Details' : 'Hide Details' }}
          </v-btn>
        </div>
      </div>

      <div class="mini-card mission-status-line">
        <div class="status-inline">
          <span class="tiny-label">Mission status</span>
          <strong>{{ activeMissionMode }}</strong>
          <span class="status-separator">•</span>
          <strong>{{ missionStatusLabel }}</strong>
          <span class="status-separator">•</span>
          <strong>{{ currentStage.label }}</strong>
          <span class="status-separator">•</span>
          <span class="muted">{{ missionType }}</span>
        </div>
        <v-btn
          v-if="resultFiles.length"
          class="ghost"
          rounded="pill"
          variant="outlined"
          size="small"
          @click="areResultsVisible = !areResultsVisible"
        >
          {{ areResultsVisible ? 'Hide Results' : 'Show Results' }}
        </v-btn>
        <v-btn
          v-if="traceItems.length"
          class="ghost"
          rounded="pill"
          variant="outlined"
          size="small"
          @click="isTraceVisible = !isTraceVisible"
        >
          {{ isTraceVisible ? 'Hide Trace' : 'Show Trace' }}
        </v-btn>
      </div>

      <div v-show="!areMissionDetailsHidden" class="chat-meta-stack">
        <div class="mini-card engine-card" :class="engineThemeClass">
          <div class="run-head">
            <strong>Current engine</strong>
            <span class="badge success">{{ llmStatus.provider }}</span>
          </div>
          <div class="engine-meta-row">
            <p class="muted">{{ currentEngine }}</p>
            <p class="muted">LLM: {{ llmStatus.provider }} / {{ llmStatus.model }}</p>
            <p class="muted">Mode routing: {{ modeRoutingHint }}</p>
          </div>
        </div>

        <div v-if="traceItems.length && isTraceVisible" class="mini-card trace-card">
          <div class="run-head">
            <strong>Mission trace</strong>
            <span class="muted">Most recent first</span>
          </div>
          <div class="trace-list">
            <div v-for="item in traceItems" :key="item.id" class="trace-row">
              <span class="trace-pill">{{ String(item.type || '').toUpperCase() }}</span>
              <span v-if="item.tool" class="trace-tool">{{ item.tool }}</span>
              <span class="trace-message">{{ String(item.message || '').slice(0, 240) }}</span>
            </div>
          </div>
        </div>

        <div v-if="pendingApprovalSummary" class="mini-card approval-ready-card">
          <div class="run-head">
            <strong>Approval Ready</strong>
            <div class="inline-input compact-toggle-row">
              <span class="badge warning">{{ pendingApprovalSummary.currentMode }} -> {{ pendingApprovalSummary.nextMode }}</span>
              <v-btn class="ghost" rounded="pill" variant="outlined" size="small" @click="isApprovalExpanded = !isApprovalExpanded">
                {{ isApprovalExpanded ? 'Less' : 'Details' }}
              </v-btn>
            </div>
          </div>
          <p class="muted compact-summary">Approval needed for <strong>{{ pendingApprovalSummary.tool }}</strong>. Estimated cost: {{ pendingApprovalSummary.estimatedCostBand }}.</p>
          <div class="action-row compact-action-row">
            <v-btn class="primary subtle" rounded="pill" @click="emit('reply-chip', 'yes')">Approve</v-btn>
            <v-btn class="ghost" rounded="pill" variant="outlined" @click="emit('reply-chip', 'no')">Reject</v-btn>
          </div>
          <div v-if="isApprovalExpanded && pendingApprovalSummary.estimatedTools.length" class="pill-row">
            <span v-for="tool in pendingApprovalSummary.estimatedTools" :key="tool" class="pill">{{ tool }}</span>
          </div>
          <div v-if="isApprovalExpanded" class="approval-detail-list">
            <p class="muted">Likely engine: {{ pendingApprovalSummary.likelyEngine }}</p>
            <p class="muted">Mode switch: {{ pendingApprovalSummary.currentMode }} -> {{ pendingApprovalSummary.nextMode }}</p>
            <p class="muted">Gemini limits are shared at the project level. Nexus estimates quota locally.</p>
          </div>
        </div>

        <div v-if="currentBlocker" class="mini-card">
          <div class="run-head">
            <strong>{{ currentBlocker.title }}</strong>
            <span class="badge warning">Action needed</span>
          </div>
          <p class="muted">{{ currentBlocker.detail }}</p>
        </div>

        <div class="mini-card boss-ops-card">
          <div class="run-head">
            <strong>Boss Workspace</strong>
            <span class="badge success">{{ activeMissionDomainLabel }}</span>
          </div>
          <div class="ops-grid">
            <div class="ops-cell">
              <span class="tiny-label">Current artifact</span>
              <strong>{{ activeArtifact?.kind || 'No active artifact yet' }}</strong>
              <p class="muted">{{ activeArtifact?.path || activeArtifact?.url || 'Generate, attach, code, quote, or publish something and Nexus will keep it here.' }}</p>
            </div>
            <div class="ops-cell">
              <span class="tiny-label">Queued next step</span>
              <strong>{{ queuedAction?.type || 'No queued step' }}</strong>
              <p class="muted">{{ queuedAction ? `Status: ${queuedAction.status}` : 'When you ask for multi-step execution, Nexus should complete the current step and then pause for approval before risky next actions.' }}</p>
            </div>
            <div class="ops-cell">
              <span class="tiny-label">Latest target</span>
              <strong>{{ latestPublishedTarget?.channel || 'No published target yet' }}</strong>
              <p class="muted">{{ latestPublishedTarget?.id || 'Published posts, outbound messages, and external targets will appear here for update/delete continuity.' }}</p>
            </div>
            <div class="ops-cell">
              <span class="tiny-label">Recent task memory</span>
              <div v-if="missionTaskStack.length" class="ops-task-list">
                <span v-for="task in missionTaskStack" :key="task.at + task.label" class="pill">{{ task.domain }}: {{ task.label }}</span>
              </div>
              <p v-else class="muted">Task switches should stay coherent across marketing, design, dev, quote, and browser work.</p>
            </div>
          </div>
          <div class="ops-hint-row">
            <span class="tiny-label">Tell Nexus like a boss</span>
            <div class="pill-row">
              <span v-for="example in bossTaskExamples" :key="example" class="pill">{{ example }}</span>
            </div>
          </div>
          <div class="ops-hint-row">
            <span class="tiny-label">Natural follow-ups</span>
            <div class="pill-row">
              <span v-for="example in bossFollowUpExamples" :key="example" class="pill">{{ example }}</span>
            </div>
          </div>
          <div class="ops-pack-grid">
            <div v-for="pack in bossCommandPacks" :key="pack.title" class="ops-pack-card">
              <span class="tiny-label">{{ pack.title }}</span>
              <div class="ops-pack-list">
                <span v-for="command in pack.commands" :key="command" class="pill">{{ command }}</span>
              </div>
            </div>
          </div>
          <div v-if="retryableJobs.length" class="ops-hint-row">
            <span class="tiny-label">Retry tasks</span>
            <div class="ops-pack-list">
              <div v-for="job in retryableJobs" :key="job.id" class="stack-item compact-stack-item">
                <div class="run-head">
                  <strong>{{ job.status }}</strong>
                  <span class="muted">{{ job.id }}</span>
                </div>
                <p class="muted">{{ job.prompt }}</p>
                <div class="action-row">
                  <v-btn
                    v-if="job.status === 'retry_wait'"
                    class="ghost"
                    rounded="pill"
                    variant="outlined"
                    size="small"
                    @click="emit('retry-job', job.id)"
                  >
                    Retry Now
                  </v-btn>
                  <v-btn
                    v-else
                    class="ghost"
                    rounded="pill"
                    variant="outlined"
                    size="small"
                    @click="emit('requeue-job', job.id)"
                  >
                    Requeue
                  </v-btn>
                </div>
              </div>
            </div>
          </div>
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
      </div>
    </div>

    <div ref="chatContainer" class="chat-stream">
      <div v-for="(msg, index) in chatHistory" :key="index" class="message-row" :class="msg.sender">
        <div class="message-card" :class="msg.sender">
          <span class="tiny-label">{{ msg.sender.startsWith('nexus') ? 'Nexus' : 'Boss' }}</span>
          <div class="message-text" v-html="formatMessage(msg.text)"></div>
        </div>
      </div>
    </div>

    <div v-if="resultFiles.length && areResultsVisible" class="mini-card mission-results-card">
      <div class="run-head">
        <div class="summary-heading">
          <span class="tiny-label">Result area</span>
          <strong>Ready outputs</strong>
        </div>
        <span class="badge success">{{ resultFiles.length }} file{{ resultFiles.length > 1 ? 's' : '' }}</span>
      </div>
      <div class="result-grid">
        <div v-for="file in resultFiles" :key="file.url || file.name" class="result-card">
          <img v-if="/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(file.url || '')" :src="file.url" :alt="file.name" class="result-preview">
          <video v-else-if="/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(file.url || '')" :src="file.url" class="result-preview" muted playsinline></video>
          <div v-else class="result-preview result-preview-placeholder">
            <strong>{{ file.name }}</strong>
          </div>
          <div class="result-copy">
            <strong>{{ file.name }}</strong>
            <span class="muted">Preview or open result</span>
          </div>
          <div class="message-asset-actions">
            <a class="message-action-btn" :href="file.url" target="_blank" rel="noreferrer">Preview</a>
            <a class="message-action-btn" :href="file.url" target="_blank" rel="noreferrer">Open</a>
          </div>
        </div>
      </div>
    </div>

    <div class="composer" @drop.prevent="handleDrop" @dragover.prevent @paste="handlePaste">
      <div class="action-row">
        <v-btn class="ghost" rounded="pill" variant="outlined" @click="triggerFilePicker">Attach File</v-btn>
        <div class="inline-input compact-mode-row composer-mode-row">
          <strong>Mode</strong>
          <v-select
            v-model="missionModeModel"
            :items="[{ title: 'Chat', value: 'chat' }, { title: 'Execute', value: 'execute' }, { title: 'Auto', value: 'auto' }]"
            item-title="title"
            item-value="value"
            density="comfortable"
            variant="outlined"
            hide-details
            class="usage-select"
          />
        </div>
              <div class="action-row composer-footer-row">
        <span class="muted composer-help">Paste, drag and drop, or attach files.</span>
        <v-btn v-if="isWorking || missionStatus === 'paused'" class="danger" rounded="pill" @click="emit('terminate')">Stop</v-btn>
        <v-btn v-else class="primary" rounded="pill" @click="emit('submit')">
          {{ String(activeMissionMode || '').toLowerCase() === 'chat' ? 'Send' : 'Launch' }}
        </v-btn>
      </div>
        <v-btn :class="isVoiceListening ? 'danger' : 'ghost'" rounded="pill" :variant="isVoiceListening ? 'flat' : 'outlined'" @click="emit(isVoiceListening ? 'stop-voice' : 'toggle-voice')">
          {{ isVoiceListening ? 'Listening...' : 'Voice' }}
        </v-btn>
        <input :id="fileInputId" ref="internalFileInput" type="file" class="hidden-input" @change="emit('file-upload', $event)" />
      </div>

      <div v-if="uploadedContextFiles.length" class="composer-uploads">
        <div v-for="file in uploadedContextFiles" :key="file.url || file.path" class="composer-upload-card">
          <img v-if="String(file.mimeType || '').startsWith('image/')" :src="file.url" :alt="file.name" class="composer-upload-thumb">
          <video v-else-if="String(file.mimeType || '').startsWith('video/')" :src="file.url" class="composer-upload-thumb" muted playsinline></video>
          <div class="composer-upload-copy">
            <strong>{{ file.name }}</strong>
            <span class="muted">{{ file.mimeType || 'Attached file' }}</span>
          </div>
          <a class="message-action-btn" :href="file.url" target="_blank" rel="noreferrer">Preview</a>
        </div>
      </div>
      <v-textarea
        v-model="promptModel"
        placeholder="Give the task like a boss: what to create, what to use, when to stop for approval, and what should happen next."
        variant="outlined"
        auto-grow
        rows="4"
        hide-details
        @keydown.enter.exact.prevent="emit('submit')"
      ></v-textarea>

    </div>
  </div>
</template>

<style scoped>
.trace-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 260px;
  overflow: auto;
  padding-right: 6px;
}

.trace-row {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 10px;
  align-items: start;
  font-size: 0.92rem;
}

.trace-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(60, 76, 97, 0.25);
  background: rgba(60, 76, 97, 0.08);
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.trace-tool {
  font-weight: 700;
  color: rgba(22, 39, 59, 0.9);
  white-space: nowrap;
}

.trace-message {
  color: rgba(22, 39, 59, 0.72);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-theme="dark"] .trace-pill {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
}

[data-theme="dark"] .trace-tool {
  color: rgba(255, 255, 255, 0.88);
}

[data-theme="dark"] .trace-message {
  color: rgba(255, 255, 255, 0.7);
}
</style>


