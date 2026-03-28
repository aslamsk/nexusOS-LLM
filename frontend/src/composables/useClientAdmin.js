export function useClientAdmin(options) {
  const {
    newClient,
    clientKeyEditing,
    isAddingClient,
    activeClient,
    clientKeysList,
    clientKeyEdits,
    isManagingClientKeys,
    activeTool,
    configEdits,
    isEditingTool,
    priorityClientKeys,
    clientKeyLabels,
    llmDefaultValues,
    fetchJson,
    showToast,
    loadClients,
    saveConfig,
    submitTask,
    promptInput,
    activeView
  } = options

  async function saveClient() {
    if (!newClient.value.name.trim()) return showToast('Client name is required, Boss', 'error')
    for (const [key, value] of Object.entries(llmDefaultValues)) {
      if (!newClient.value.initialKeys[key]) newClient.value.initialKeys[key] = value
    }
    await fetchJson('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newClient.value) })
    newClient.value = { name: '', company: '', email: '', phone: '', notes: '', initialKeys: {} }
    clientKeyEditing.value = ''
    isAddingClient.value = false
    showToast('Client created')
    await loadClients()
  }

  async function manageClientKeys(client) {
    activeClient.value = client
    const data = await fetchJson(`/api/clients/${client.id}/keys`)
    const keys = data.keys || []
    clientKeysList.value = [...keys].sort((a, b) => {
      const aIdx = priorityClientKeys.indexOf(a.key)
      const bIdx = priorityClientKeys.indexOf(b.key)
      const normalizedA = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx
      const normalizedB = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx
      if (normalizedA !== normalizedB) return normalizedA - normalizedB
      return String(a.label || a.key).localeCompare(String(b.label || b.key))
    })
    const edits = {}
    for (const item of clientKeysList.value) edits[item.key] = item.isSet ? item.value : ''
    for (const [key, value] of Object.entries(llmDefaultValues)) {
      if (!edits[key]) edits[key] = value
    }
    clientKeyEdits.value = edits
    isManagingClientKeys.value = true
  }

  async function saveClientKeys() {
    await fetchJson(`/api/clients/${activeClient.value.id}/keys`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: clientKeyEdits.value }) })
    isManagingClientKeys.value = false
    showToast('Client keys saved')
  }

  async function editTool(tool) {
    activeTool.value = tool
    const data = await fetchJson('/api/config')
    const rulesKey = `TOOL_${tool.id.toUpperCase()}_RULES`
    const existing = (data.configs || []).find((entry) => entry.key === rulesKey)
    configEdits.value[rulesKey] = existing?.isSet ? existing.value : configEdits.value[rulesKey] || ''
    isEditingTool.value = true
  }

  async function updateToolConfig() {
    await saveConfig()
    isEditingTool.value = false
    showToast(`${activeTool.value.name} guidance saved`)
  }

  function testTool(tool) {
    activeView.value = 'chat'
    promptInput.value = `Run a diagnostic on ${tool.name}. Validate readiness, note blockers, and give me the operational status.`
    submitTask()
  }

  return {
    saveClient,
    manageClientKeys,
    saveClientKeys,
    editTool,
    updateToolConfig,
    testTool
  }
}
