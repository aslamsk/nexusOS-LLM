<script setup>
defineProps({
  clientUsageSummary: { type: Object, required: true },
  clients: { type: Array, required: true },
  downloadUsageReport: { type: Function, required: true },
  dualCurrency: { type: Function, required: true },
  globalUsageChart: { type: Array, required: true },
  globalUsageSummary: { type: Object, required: true },
  mostExpensiveClient: { type: Object, default: null },
  mostExpensiveModel: { type: Object, default: null },
  prettyDate: { type: Function, required: true },
  providerShareRows: { type: Array, required: true },
  recentProviderSwitches: { type: Array, required: true },
  refreshUsagePanels: { type: Function, required: true },
  selectedFinanceClient: { type: String, default: '' },
  usageLeaders: { type: Array, required: true },
  usagePeriod: { type: String, required: true }
})

const emit = defineEmits(['update:selectedFinanceClient', 'update:usagePeriod'])
</script>

<template>
  <section class="grid-two">
    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">KPIs</span><h3>Usage summary tiles</h3></div>
      </div>
      <div class="card-grid">
        <div class="mini-card"><label>Period calls</label><strong>{{ globalUsageSummary.totals.calls || 0 }}</strong><p class="muted">{{ usagePeriod.toUpperCase() }}</p></div>
        <div class="mini-card"><label>Free calls</label><strong>{{ globalUsageSummary.totals.freeCalls || 0 }}</strong><p class="muted">estimated free</p></div>
        <div class="mini-card"><label>Paid calls</label><strong>{{ globalUsageSummary.totals.paidCalls || 0 }}</strong><p class="muted">estimated paid</p></div>
        <div class="mini-card"><label>Paid cost</label><strong>{{ dualCurrency(globalUsageSummary.totals.estimatedCostUsd || 0) }}</strong><p class="muted">estimated cost</p></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Tracked Usage</span><h3>Boss / default usage overview</h3></div>
      </div>
      <div class="action-row">
        <v-select
          :model-value="usagePeriod"
          :items="[
            { title: 'All time', value: 'all' },
            { title: 'Today', value: 'today' },
            { title: 'Last 7 days', value: '7d' },
            { title: 'Last 30 days', value: '30d' }
          ]"
          item-title="title"
          item-value="value"
          density="comfortable"
          variant="outlined"
          hide-details
          class="usage-select"
          @update:model-value="emit('update:usagePeriod', $event)"
        />
        <v-btn class="ghost" rounded="pill" variant="outlined" @click="refreshUsagePanels">Refresh Usage</v-btn>
        <v-btn class="ghost" rounded="pill" variant="outlined" @click="downloadUsageReport('global', 'csv')">Export CSV</v-btn>
        <v-btn class="ghost" rounded="pill" variant="outlined" @click="downloadUsageReport('global', 'pdf')">Export PDF</v-btn>
      </div>
      <div class="stack-list">
        <div class="stack-item">
          <strong>Tracked Nexus usage</strong>
          <p class="muted">{{ globalUsageSummary.totals.calls || 0 }} total calls · {{ globalUsageSummary.totals.freeCalls || 0 }} free · {{ globalUsageSummary.totals.paidCalls || 0 }} paid</p>
          <p class="muted">{{ globalUsageSummary.totals.totalTokens || 0 }} total tokens | {{ globalUsageSummary.totals.inputTokens || 0 }} in | {{ globalUsageSummary.totals.outputTokens || 0 }} out</p>
          <p class="muted">{{ dualCurrency(globalUsageSummary.totals.estimatedCostUsd || 0) }} estimated paid usage</p>
          <p class="muted">Exact for requests routed through Nexus. This is not Google-official remaining quota.</p>
        </div>
        <div v-if="globalUsageSummary.providers?.length" class="stack-item">
          <strong>Tracked provider breakdown</strong>
          <p v-for="provider in globalUsageSummary.providers" :key="provider.provider" class="muted">{{ provider.provider }} · {{ provider.calls }} calls · {{ provider.freeCalls }} free · {{ provider.paidCalls }} paid · {{ dualCurrency(provider.estimatedCostUsd || 0) }} · {{ provider.resetCadence }} · {{ Object.keys(provider.kinds || {}).join(' + ') || 'llm' }}</p>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Trend</span><h3>Daily usage trend</h3></div>
      </div>
      <div v-if="globalUsageChart.length" class="usage-chart">
        <div v-for="point in globalUsageChart" :key="point.date" class="usage-bar-wrap">
          <div class="usage-bar" :style="{ height: point.height }" :title="`${point.date}: ${point.calls} calls`"></div>
          <span>{{ point.date.slice(5) }}</span>
        </div>
      </div>
      <p v-else class="muted">Trend data will appear after usage events are recorded.</p>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Share</span><h3>Provider share</h3></div>
      </div>
      <div v-if="providerShareRows.length" class="stack-list">
        <div v-for="provider in providerShareRows" :key="provider.provider" class="stack-item">
          <div class="run-head"><strong>{{ provider.provider }}</strong><span>{{ provider.percentage }}%</span></div>
          <p class="muted">{{ provider.calls }} calls · {{ dualCurrency(provider.estimatedCostUsd || 0) }}</p>
        </div>
      </div>
      <p v-else class="muted">Provider share will appear after tracked usage accumulates.</p>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Tracked Usage</span><h3>Client usage breakdown</h3></div>
        <div class="context-box">
          <label>Client</label>
          <v-select
            :model-value="selectedFinanceClient"
            :items="[{ title: 'Select Client', value: '' }, ...clients.map((client) => ({ title: client.name, value: client.id }))]"
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
        <v-btn class="ghost" rounded="pill" variant="outlined" @click="refreshUsagePanels">Refresh Usage</v-btn>
        <v-btn class="ghost" rounded="pill" variant="outlined" :disabled="!selectedFinanceClient" @click="downloadUsageReport('client', 'csv')">Export CSV</v-btn>
        <v-btn class="ghost" rounded="pill" variant="outlined" :disabled="!selectedFinanceClient" @click="downloadUsageReport('client', 'pdf')">Export PDF</v-btn>
      </div>
      <div class="stack-list">
        <div class="stack-item">
          <strong>Tracked client usage</strong>
          <p class="muted">{{ clientUsageSummary.totals.calls || 0 }} total calls · {{ clientUsageSummary.totals.freeCalls || 0 }} free · {{ clientUsageSummary.totals.paidCalls || 0 }} paid</p>
          <p class="muted">{{ clientUsageSummary.totals.totalTokens || 0 }} total tokens | {{ clientUsageSummary.totals.inputTokens || 0 }} in | {{ clientUsageSummary.totals.outputTokens || 0 }} out</p>
          <p class="muted">{{ dualCurrency(clientUsageSummary.totals.estimatedCostUsd || 0) }} estimated paid usage</p>
          <p class="muted">Exact for activity executed through Nexus under this client context only.</p>
        </div>
        <div v-if="clientUsageSummary.providers?.length" class="stack-item">
          <strong>Providers</strong>
          <p v-for="provider in clientUsageSummary.providers" :key="provider.provider" class="muted">{{ provider.provider }} · {{ provider.calls }} calls · {{ provider.freeCalls }} free · {{ provider.paidCalls }} paid · {{ dualCurrency(provider.estimatedCostUsd || 0) }} · {{ provider.resetCadence }} · {{ Object.keys(provider.kinds || {}).join(' + ') || 'llm' }}</p>
        </div>
        <div v-if="clientUsageSummary.models?.length" class="stack-item">
          <strong>Models</strong>
          <p v-for="model in clientUsageSummary.models" :key="`${model.provider}-${model.model}-${model.mode}`" class="muted">{{ model.provider }} / {{ model.model }} · {{ model.calls }} calls · {{ model.freeCalls }} free · {{ model.paidCalls }} paid · {{ model.resetCadence }} · {{ model.kind || 'llm' }}</p>
        </div>
      </div>
      <p v-if="!selectedFinanceClient" class="muted">Select a client to see client-based model and media usage.</p>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Models</span><h3>Global model breakdown</h3></div>
      </div>
      <div v-if="globalUsageSummary.models?.length" class="stack-list">
        <div v-for="model in globalUsageSummary.models" :key="`${model.provider}-${model.model}`" class="stack-item">
          <div class="run-head"><strong>{{ model.provider }}</strong><span>{{ model.kind || 'llm' }}</span></div>
          <p class="muted">{{ model.model }}</p>
          <p class="muted">{{ model.calls }} calls · {{ model.freeCalls }} free · {{ model.paidCalls }} paid · {{ dualCurrency(model.estimatedCostUsd || 0) }}</p>
          <p class="muted">{{ model.resetCadence }}</p>
        </div>
      </div>
      <p v-else class="muted">No model usage recorded yet.</p>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Fallbacks</span><h3>Provider switch history</h3></div>
      </div>
      <div v-if="recentProviderSwitches.length" class="stack-list">
        <div v-for="item in recentProviderSwitches" :key="`${item.runId}-${item.at}`" class="stack-item">
          <div class="run-head"><strong>{{ item.from }} -> {{ item.to }}</strong><span>{{ prettyDate(item.at) }}</span></div>
          <p class="muted">{{ item.model || 'no model noted' }}</p>
          <p class="muted">{{ item.requestPreview }}</p>
        </div>
      </div>
      <p v-else class="muted">Fallback switch events will appear here when Nexus rolls from one provider to another.</p>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Clients</span><h3>Top clients by usage</h3></div>
      </div>
      <div v-if="usageLeaders.length" class="stack-list">
        <div v-for="leader in usageLeaders" :key="leader.clientId" class="stack-item">
          <div class="run-head"><strong>{{ leader.clientName }}</strong><span>{{ leader.calls }} calls</span></div>
          <p class="muted">{{ leader.freeCalls || 0 }} free · {{ leader.paidCalls || 0 }} paid · {{ dualCurrency(leader.estimatedCostUsd || 0) }}</p>
        </div>
      </div>
      <p v-else class="muted">Client leaders will appear after tracked usage accumulates.</p>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Expensive</span><h3>Highest cost drivers</h3></div>
      </div>
      <div class="stack-list">
        <div v-if="mostExpensiveClient" class="stack-item">
          <strong>Most expensive client</strong>
          <p class="muted">{{ mostExpensiveClient.clientName }}</p>
          <p class="muted">{{ dualCurrency(mostExpensiveClient.estimatedCostUsd || 0) }} · {{ mostExpensiveClient.calls }} calls</p>
        </div>
        <div v-if="mostExpensiveModel" class="stack-item">
          <strong>Most expensive model</strong>
          <p class="muted">{{ mostExpensiveModel.provider }} / {{ mostExpensiveModel.model }}</p>
          <p class="muted">{{ dualCurrency(mostExpensiveModel.estimatedCostUsd || 0) }} · {{ mostExpensiveModel.calls }} calls</p>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Guidance</span><h3>Free tier interpretation</h3></div>
      </div>
      <div class="stack-list">
        <div class="stack-item">
          <strong>Estimated free vs paid</strong>
          <p class="muted">These numbers are inferred from provider, model, and quota mode. They are not yet direct billing sync from Gemini, OpenRouter, Groq, NVIDIA, or media providers.</p>
        </div>
        <div class="stack-item">
          <strong>Reset cadence</strong>
          <p class="muted">Nexus shows a practical reset hint like daily free window, provider quota window, or paid usage. Exact resets still depend on each provider console and account plan.</p>
        </div>
      </div>
    </div>
  </section>
</template>
