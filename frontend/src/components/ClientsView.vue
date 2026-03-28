<script setup>
const props = defineProps({
  clients: { type: Array, required: true },
  loadClients: { type: Function, required: true },
  manageClientKeys: { type: Function, required: true },
  launchMarketingPreset: { type: Function, required: true },
  setClientChatContext: { type: Function, required: true },
  selectedFinanceClient: { type: String, default: '' },
  usagePeriod: { type: String, default: 'all' },
  clientUsageSummary: { type: Object, required: true },
  latestSessions: { type: Array, required: true },
  dualCurrency: { type: Function, required: true },
  prettyDate: { type: Function, required: true },
  refreshUsagePanels: { type: Function, required: true },
  downloadUsageReport: { type: Function, required: true }
})

const emit = defineEmits(['update:selectedFinanceClient', 'update:usagePeriod'])
</script>

<template>
  <section class="grid-two">
    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Client operations</span>
          <h3>Accounts and isolated keys</h3>
        </div><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.loadClients">Refresh</v-btn>
      </div>
      <div class="card-grid">
        <div v-for="client in props.clients" :key="client.id" class="mini-card">
          <div class="run-head"><strong>{{ client.name }}</strong><span class="badge success">{{ client.status ||
            'active' }}</span></div>
          <p class="muted">{{ client.company || 'No organization listed' }}</p>
          <p class="muted">{{ client.email || 'No email set' }}</p>
          <div class="action-row">
            <v-btn class="ghost" rounded="pill" variant="outlined" @click="props.manageClientKeys(client)">Keys</v-btn>
            <v-btn class="ghost" rounded="pill" variant="outlined" @click="props.launchMarketingPreset(client)">Marketing</v-btn>
            <v-btn class="primary subtle" rounded="pill" @click="props.setClientChatContext(client.id)">Use Context</v-btn>
          </div>
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Client usage</span>
          <h3>Model usage by client</h3>
        </div>
        <div class="context-box">
          <label>Client</label>
          <v-select
            :model-value="props.selectedFinanceClient"
            :items="[{ title: 'Select Client', value: '' }, ...props.clients.map((client) => ({ title: client.name, value: client.id }))]"
            item-title="title"
            item-value="value"
            density="comfortable"
            variant="outlined"
            hide-details
            @update:model-value="emit('update:selectedFinanceClient', $event)"
          />
        </div>
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
        <v-btn class="ghost" rounded="pill" variant="outlined" :disabled="!props.selectedFinanceClient" @click="props.downloadUsageReport('client', 'csv')">Export CSV</v-btn>
        <v-btn class="ghost" rounded="pill" variant="outlined" :disabled="!props.selectedFinanceClient" @click="props.downloadUsageReport('client', 'pdf')">Export PDF</v-btn>
      </div>
      <div class="stack-list">
        <div class="stack-item"><strong>Total model calls</strong>
          <p class="muted">{{ props.clientUsageSummary.totals.calls || 0 }} total · {{ props.clientUsageSummary.totals.freeCalls || 0 }} free · {{ props.clientUsageSummary.totals.paidCalls || 0 }} paid</p>
          <p class="muted">{{ props.dualCurrency(props.clientUsageSummary.totals.estimatedCostUsd || 0) }} est. paid usage</p>
        </div>
        <div v-if="props.clientUsageSummary.providers?.length" class="stack-item">
          <strong>Tracked providers</strong>
          <p v-for="provider in props.clientUsageSummary.providers.slice(0, 6)" :key="provider.provider" class="muted">{{ provider.provider }} · {{ provider.calls }} calls · {{ provider.freeCalls }} free · {{ provider.paidCalls }} paid · {{ props.dualCurrency(provider.estimatedCostUsd || 0) }} · {{ provider.resetCadence }} · {{ Object.keys(provider.kinds || {}).join(' + ') || 'llm' }}</p>
        </div>
        <div v-if="props.clientUsageSummary.models?.length" class="stack-item">
          <strong>Tracked models</strong>
          <p v-for="model in props.clientUsageSummary.models.slice(0, 8)" :key="`${model.provider}-${model.model}`" class="muted">{{ model.provider }} / {{ model.model }} · {{ model.calls }} calls · {{ model.freeCalls }} free · {{ model.paidCalls }} paid · {{ model.resetCadence }} · {{ model.kind || 'llm' }}</p>
        </div>
      </div>
      <p v-if="!props.selectedFinanceClient" class="muted">Select a client to view model usage totals and free vs paid estimates.</p>
    </div>
    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Sessions</span>
          <h3>Recent recoveries</h3>
        </div>
      </div>
      <div v-if="props.latestSessions.length" class="stack-list">
        <div v-for="session in props.latestSessions" :key="session.id" class="stack-item">
          <strong>{{ session.preview }}</strong>
          <p class="muted">{{ props.prettyDate(session.lastUpdated) }}</p>
        </div>
      </div>
      <p v-else class="muted">Saved sessions will appear here.</p>
    </div>
  </section>
</template>
