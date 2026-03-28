<script setup>
const props = defineProps({
  toolsData: { type: Array, required: true },
  loadToolsDashboard: { type: Function, required: true },
  editTool: { type: Function, required: true },
  testTool: { type: Function, required: true }
})
</script>

<template>
  <section class="panel">
    <div class="panel-head">
      <div><span class="tiny-label">Capabilities</span>
        <h3>Provider readiness matrix</h3>
      </div>
      <v-btn class="ghost" rounded="pill" variant="outlined" @click="props.loadToolsDashboard">Refresh</v-btn>
    </div>
    <div class="card-grid">
      <div v-for="tool in props.toolsData" :key="tool.id" class="mini-card">
        <div class="run-head"><strong>{{ tool.name }}</strong><span class="badge" :class="tool.status === 'active' ? 'success' : 'warning'">{{ tool.status }}</span></div>
        <p class="muted">{{ tool.description }}</p>
        <p v-if="tool.diagnostics?.missingKeys?.length" class="muted">Missing: {{ tool.diagnostics.missingKeys.join(', ') }}</p>
        <p v-else-if="tool.diagnostics?.ready" class="muted">Ready: {{ (tool.diagnostics.configuredKeys || []).join(', ') || 'configured' }}</p>
        <div class="action-row">
          <v-btn class="ghost" rounded="pill" variant="outlined" @click="props.editTool(tool)">Configure</v-btn>
          <v-btn class="primary subtle" rounded="pill" @click="props.testTool(tool)">Test</v-btn>
        </div>
      </div>
    </div>
  </section>
</template>
