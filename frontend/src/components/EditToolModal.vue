<script setup>
defineProps({
  isOpen: { type: Boolean, default: false },
  activeTool: { type: Object, default: null },
  configEdits: { type: Object, required: true },
  testTool: { type: Function, required: true },
  updateToolConfig: { type: Function, required: true }
})

const emit = defineEmits(['close'])
</script>

<template>
  <transition name="fade">
    <div v-if="isOpen && activeTool" class="modal-backdrop" @click.self="emit('close')">
      <div class="modal-card">
        <div class="panel-head">
          <div><span class="tiny-label">Capability tuning</span>
            <h3>{{ activeTool.name }}</h3>
          </div>
          <v-btn class="ghost" rounded="pill" variant="outlined" @click="emit('close')">Close</v-btn>
        </div>
        <div class="mini-card">
          <p class="muted">{{ activeTool.description }}</p>
          <span class="badge" :class="activeTool.status === 'active' ? 'success' : 'warning'">{{ activeTool.status === 'active' ? 'Operational' : 'Needs credentials' }}</span>
        </div>
        <div class="mini-card">
          <label>Operational rules</label>
          <textarea v-model="configEdits[`TOOL_${activeTool.id.toUpperCase()}_RULES`]" placeholder="Example: Always return JSON with a short summary and risk flags."></textarea>
        </div>
        <div class="action-row">
          <v-btn class="ghost" rounded="pill" variant="outlined" @click="testTool(activeTool)">Run Test</v-btn>
          <v-btn class="primary" rounded="pill" @click="updateToolConfig">Save Guidance</v-btn>
        </div>
      </div>
    </div>
  </transition>
</template>
