<script setup>
const props = defineProps({
  usagePeriod: { type: String, default: 'all' },
  refreshUsagePanels: { type: Function, required: true },
  downloadUsageReport: { type: Function, required: true },
  globalUsageSummary: { type: Object, required: true },
  dualCurrency: { type: Function, required: true },
  configGroups: { type: Array, required: true },
  configEdits: { type: Object, required: true },
  revealKeys: { type: Object, required: true },
  saveConfig: { type: Function, required: true }
})

const emit = defineEmits(['update:usagePeriod'])
</script>

<template>
  <section class="panel">
    <div class="panel-head">
      <div><span class="tiny-label">Configuration</span>
        <h3>Keys and quota controls</h3>
      </div>
    </div>
    <div class="stack-list">
      <div class="stack-item">
        <strong>Boss / Global default mode</strong>
        <p class="muted">Primary Gemini first, then OpenRouter, Groq, and NVIDIA fallback when configured.</p>
      </div>
      <div class="action-row">
        <v-select
          :model-value="props.usagePeriod"
          :items="[{ title: 'All time', value: 'all' }, { title: 'Today', value: 'today' }, { title: 'Last 7 days', value: '7d' }, { title: 'Last 30 days', value: '30d' }]"
          item-title="title"
          item-value="value"
          density="comfortable"
          variant="outlined"
          hide-details
          class="usage-select"
          @update:model-value="emit('update:usagePeriod', $event)"
        />
        <v-btn class="ghost" rounded="pill" variant="outlined" @click="props.refreshUsagePanels">Refresh Usage</v-btn>
        <v-btn class="ghost" rounded="pill" variant="outlined" @click="props.downloadUsageReport('global', 'csv')">Export CSV</v-btn>
        <v-btn class="ghost" rounded="pill" variant="outlined" @click="props.downloadUsageReport('global', 'pdf')">Export PDF</v-btn>
      </div>
      <div class="stack-item">
        <strong>Global model usage</strong>
        <p class="muted">{{ props.globalUsageSummary.totals.calls || 0 }} total calls · {{ props.globalUsageSummary.totals.freeCalls || 0 }} free · {{ props.globalUsageSummary.totals.paidCalls || 0 }} paid</p>
        <p class="muted">{{ props.dualCurrency(props.globalUsageSummary.totals.estimatedCostUsd || 0) }} estimated paid usage</p>
      </div>
      <div v-if="props.globalUsageSummary.providers?.length" class="stack-item">
        <strong>Provider breakdown</strong>
        <p v-for="provider in props.globalUsageSummary.providers.slice(0, 8)" :key="provider.provider" class="muted">{{ provider.provider }} · {{ provider.calls }} calls · {{ provider.freeCalls }} free · {{ provider.paidCalls }} paid · {{ props.dualCurrency(provider.estimatedCostUsd || 0) }} · {{ provider.resetCadence }} · {{ Object.keys(provider.kinds || {}).join(' + ') || 'llm' }}</p>
      </div>
      <div v-if="props.globalUsageSummary.models?.length" class="stack-item">
        <strong>Model breakdown</strong>
        <p v-for="model in props.globalUsageSummary.models.slice(0, 10)" :key="`${model.provider}-${model.model}`" class="muted">{{ model.provider }} / {{ model.model }} · {{ model.calls }} calls · {{ model.freeCalls }} free · {{ model.paidCalls }} paid · {{ model.resetCadence }} · {{ model.kind || 'llm' }}</p>
      </div>
    </div>
    <div v-for="group in props.configGroups" :key="group.title" class="settings-group">
      <div class="panel-head compact-head">
        <div><span class="tiny-label">Configuration group</span>
          <h3>{{ group.title }}</h3>
        </div>
      </div>
      <div class="card-grid">
        <div v-for="entry in group.entries" :key="entry.key" class="mini-card">
          <label>{{ entry.label }}</label>
          <v-select
            v-if="entry.key === 'QUOTA_MODE'"
            v-model="props.configEdits[entry.key]"
            :items="[{ title: 'FREE', value: 'FREE' }, { title: 'NORMAL', value: 'NORMAL' }, { title: 'HIGH', value: 'HIGH' }]"
            item-title="title"
            item-value="value"
            density="comfortable"
            variant="outlined"
            hide-details
          />
          <div v-else class="inline-input">
            <input :type="props.revealKeys[entry.key] ? 'text' : 'password'" v-model="props.configEdits[entry.key]" :placeholder="entry.isSet ? 'Configured' : 'Unset'">
            <v-btn class="ghost" rounded="pill" variant="outlined" @click="props.revealKeys[entry.key] = !props.revealKeys[entry.key]">{{ props.revealKeys[entry.key] ? 'Hide' : 'Show' }}</v-btn>
          </div>
        </div>
      </div>
    </div>
    <div class="action-row"><v-btn class="primary" rounded="pill" @click="props.saveConfig">Save Settings</v-btn></div>
  </section>
</template>
