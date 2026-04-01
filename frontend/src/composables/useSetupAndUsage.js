export function useSetupAndUsage(options) {
  const {
    activeView,
    configEntries,
    configEdits,
    revealKeys,
    clients,
    globalUsageSummary,
    clientUsageSummary,
    usagePeriod,
    usageLeaders,
    selectedFinanceClient,
    toolsData,
    setupDoctor,
    setupPlaybooks,
    sessionCatalog,
    systemHealth,
    fetchJson,
    showToast,
    configFallbackLabels,
    llmDefaultValues
  } = options

  async function openSettings() {
    activeView.value = 'settings'
    const data = await fetchJson('/api/config')
    const incomingEntries = data.configs || []
    const entryMap = new Map(incomingEntries.map((entry) => [entry.key, entry]))
    for (const [key, label] of Object.entries(configFallbackLabels)) {
      if (!entryMap.has(key)) {
        entryMap.set(key, { key, label, value: '', isSet: false })
      }
    }
    configEntries.value = Array.from(entryMap.values())
    const edits = {}
    const reveals = {}
    for (const entry of configEntries.value) {
      edits[entry.key] = entry.isSet ? entry.value : (llmDefaultValues[entry.key] || '')
      reveals[entry.key] = false
    }
    configEdits.value = edits
    revealKeys.value = reveals
    await loadGlobalUsageSummary()
  }

  async function saveConfig() {
    const updates = {}
    for (const [key, value] of Object.entries(configEdits.value)) {
      if (value !== '') updates[key] = value
    }
    await fetchJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    })
    showToast('System configuration updated')
  }

  async function loadClients() {
    clients.value = (await fetchJson('/api/clients')).clients || []
  }

  async function loadGlobalUsageSummary() {
    globalUsageSummary.value = (await fetchJson(`/api/usage/summary?period=${encodeURIComponent(usagePeriod.value)}`)).summary || globalUsageSummary.value
  }

  async function loadClientUsageSummary(clientId) {
    if (!clientId) {
      clientUsageSummary.value = { totals: { calls: 0, freeCalls: 0, paidCalls: 0, toolCalls: 0, llmCalls: 0, mediaCalls: 0, activeDays: 0, estimatedCostUsd: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 }, providers: [], models: [], tools: [], window: { firstUsedAt: null, lastUsedAt: null }, daily: [] }
      return
    }
    clientUsageSummary.value = (await fetchJson(`/api/usage/summary?clientId=${encodeURIComponent(clientId)}&period=${encodeURIComponent(usagePeriod.value)}`)).summary || clientUsageSummary.value
  }

  async function refreshUsagePanels() {
    globalUsageSummary.value = (await fetchJson(`/api/usage/summary?period=${encodeURIComponent(usagePeriod.value)}`)).summary || globalUsageSummary.value
    usageLeaders.value = (await fetchJson(`/api/usage/leaderboard?period=${encodeURIComponent(usagePeriod.value)}`)).leaders || usageLeaders.value
    if (selectedFinanceClient.value) {
      clientUsageSummary.value = (await fetchJson(`/api/usage/summary?clientId=${encodeURIComponent(selectedFinanceClient.value)}&period=${encodeURIComponent(usagePeriod.value)}`)).summary || clientUsageSummary.value
    }
  }

  function downloadUsageReport(scope = 'global', format = 'csv') {
    const clientId = scope === 'client' ? selectedFinanceClient.value : ''
    const params = new URLSearchParams({ format, period: usagePeriod.value })
    if (clientId) params.set('clientId', clientId)
    const link = document.createElement('a')
    link.href = `/api/usage/export?${params.toString()}`
    link.download = ''
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function loadToolsDashboard() {
    toolsData.value = (await fetchJson('/api/system-status')).integrations || []
  }

  async function loadSetupCenter(prompt = '') {
    const [doctorData, playbookData] = await Promise.all([
      fetchJson(`/api/setup/doctor${prompt ? `?prompt=${encodeURIComponent(prompt)}` : ''}`),
      fetchJson('/api/setup/playbooks')
    ])
    setupDoctor.value = doctorData.report || setupDoctor.value
    setupPlaybooks.value = playbookData.playbooks || []
  }

  async function loadSessionCatalog() {
    sessionCatalog.value = (await fetchJson('/api/sessions')).sessions || []
  }

  async function loadSystemHealth() {
    systemHealth.value = await fetchJson('/api/health')
  }

  return {
    openSettings,
    saveConfig,
    loadClients,
    loadGlobalUsageSummary,
    loadClientUsageSummary,
    refreshUsagePanels,
    downloadUsageReport,
    loadToolsDashboard,
    loadSetupCenter,
    loadSessionCatalog,
    loadSystemHealth
  }
}
