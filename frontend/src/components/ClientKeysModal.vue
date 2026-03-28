<script setup>
defineProps({
  isOpen: { type: Boolean, default: false },
  activeClient: { type: Object, default: null },
  clientKeysList: { type: Array, required: true },
  clientKeyLabels: { type: Object, required: true },
  clientKeyInfo: { type: Object, required: true },
  clientKeyEdits: { type: Object, required: true },
  openKeySetupWithNexus: { type: Function, required: true },
  saveClientKeys: { type: Function, required: true }
})

const emit = defineEmits(['close'])
</script>

<template>
  <transition name="fade">
    <div v-if="isOpen && activeClient" class="modal-backdrop" @click.self="emit('close')">
      <div class="modal-card">
        <div class="panel-head">
          <div><span class="tiny-label">Key management</span>
            <h3>{{ activeClient.name }}</h3>
          </div>
          <v-btn class="ghost" rounded="pill" variant="outlined" @click="emit('close')">Close</v-btn>
        </div>
        <div class="stack-list">
          <div class="stack-item"><strong>LLM fallback keys appear first</strong>
            <p class="muted">Gemini primary/backup, then OpenRouter, Groq, and NVIDIA client-specific overrides.</p>
          </div>
        </div>
        <div class="card-grid">
          <div v-for="keyRow in clientKeysList" :key="keyRow.key" class="mini-card">
            <label>{{ keyRow.label || clientKeyLabels[keyRow.key] || keyRow.key }}</label>
            <p v-if="clientKeyInfo[keyRow.key]?.howTo" class="muted">{{ clientKeyInfo[keyRow.key].howTo }}</p>
            <div v-if="clientKeyInfo[keyRow.key]?.setupPrompt" class="action-row compact-row">
              <v-btn class="ghost" rounded="pill" variant="outlined" @click="openKeySetupWithNexus(keyRow.key)">Set up with Nexus</v-btn>
            </div>
            <input type="password" v-model="clientKeyEdits[keyRow.key]" :placeholder="keyRow.isSet ? 'Configured' : 'Unset'">
          </div>
        </div>
        <div class="action-row"><v-btn class="primary" rounded="pill" @click="saveClientKeys">Save Keys</v-btn></div>
      </div>
    </div>
  </transition>
</template>
