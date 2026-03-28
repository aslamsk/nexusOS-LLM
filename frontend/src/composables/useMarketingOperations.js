export function useMarketingOperations(options) {
  const {
    marketingWorkflows,
    marketingAuditSpecialists,
    marketingOutputs,
    marketingBriefs,
    generatedAuditBundle,
    marketingUtilityResults,
    marketingDraft,
    generatedMarketingBrief,
    competitorInput,
    socialWeeks,
    socialTheme,
    selectedClientForChat,
    selectedFinanceClient,
    activeView,
    promptInput,
    clients,
    fetchJson,
    showToast
  } = options

  async function loadMarketingWorkflows() {
    const data = await fetchJson('/api/marketing/workflows')
    marketingWorkflows.value = data.workflows || []
    marketingAuditSpecialists.value = Object.entries(data.auditSpecialists || {}).map(([id, item]) => ({ id, ...item }))
  }

  async function loadMarketingOutputs(clientId = '') { marketingOutputs.value = (await fetchJson(`/api/marketing/outputs${clientId ? `?clientId=${clientId}` : ''}`)).outputs || [] }
  async function loadMarketingBriefs(clientId = '') { marketingBriefs.value = (await fetchJson(`/api/marketing/briefs${clientId ? `?clientId=${clientId}` : ''}`)).briefs || [] }

  async function generateMarketingBrief() {
    const parsedChannels = Array.isArray(marketingDraft.value.channels)
      ? marketingDraft.value.channels
      : String(marketingDraft.value.channels || '').split(',').map((item) => item.trim()).filter(Boolean)
    const data = await fetchJson('/api/marketing/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...marketingDraft.value,
        channels: parsedChannels,
        clientId: selectedClientForChat.value || selectedFinanceClient.value || null
      })
    })
    generatedMarketingBrief.value = data.brief
    showToast('Marketing brief generated')
  }

  function launchMarketingBrief() {
    if (!generatedMarketingBrief.value) return showToast('Generate a marketing brief first', 'error')
    activeView.value = 'chat'
    promptInput.value = generatedMarketingBrief.value
  }

  function launchMarketingPreset(client, workflowId = 'audit') {
    activeView.value = 'marketing'
    selectedClientForChat.value = client.id
    selectedFinanceClient.value = client.id
    marketingDraft.value.workflowId = workflowId
    marketingDraft.value.target = client.company || client.name
    marketingDraft.value.notes = client.notes || ''
    generatedMarketingBrief.value = ''
    generatedAuditBundle.value = ''
    loadMarketingWorkflows()
    loadMarketingBriefs(client.id)
    loadMarketingOutputs(client.id)
  }

  async function generateAuditBundle() {
    const parsedChannels = Array.isArray(marketingDraft.value.channels)
      ? marketingDraft.value.channels
      : String(marketingDraft.value.channels || '').split(',').map((item) => item.trim()).filter(Boolean)
    const data = await fetchJson('/api/marketing/audit-bundle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: marketingDraft.value.target,
        notes: marketingDraft.value.notes,
        budget: marketingDraft.value.budget,
        channels: parsedChannels,
        clientId: selectedClientForChat.value || selectedFinanceClient.value || null
      })
    })
    generatedAuditBundle.value = `${data.auditBundle.context}\n\n${data.auditBundle.brief}`
    showToast('Multi-specialist audit bundle generated')
  }

  function launchAuditBundle() {
    if (!generatedAuditBundle.value) return showToast('Generate the audit bundle first', 'error')
    activeView.value = 'chat'
    promptInput.value = generatedAuditBundle.value
  }

  async function runPageAnalysis() {
    if (!marketingDraft.value.target) return showToast('Add a target URL or topic first', 'error')
    const parsedChannels = Array.isArray(marketingDraft.value.channels)
      ? marketingDraft.value.channels
      : String(marketingDraft.value.channels || '').split(',').map((item) => item.trim()).filter(Boolean)
    const data = await fetchJson('/api/marketing/page-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: marketingDraft.value.target, notes: marketingDraft.value.notes, channels: parsedChannels })
    })
    marketingUtilityResults.value.pageAnalysis = data.result
    showToast('Page analysis generated')
  }

  async function runCompetitorScan() {
    if (!marketingDraft.value.target) return showToast('Add a target brand or URL first', 'error')
    const data = await fetchJson('/api/marketing/competitor-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: marketingDraft.value.target, competitors: competitorInput.value, notes: marketingDraft.value.notes })
    })
    marketingUtilityResults.value.competitorScan = data.result
    showToast('Competitor scan generated')
  }

  async function runSocialCalendar() {
    if (!marketingDraft.value.target) return showToast('Add a campaign target or topic first', 'error')
    const parsedChannels = Array.isArray(marketingDraft.value.channels)
      ? marketingDraft.value.channels
      : String(marketingDraft.value.channels || '').split(',').map((item) => item.trim()).filter(Boolean)
    const data = await fetchJson('/api/marketing/social-calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: marketingDraft.value.target, channels: parsedChannels, weeks: socialWeeks.value, theme: socialTheme.value, notes: marketingDraft.value.notes })
    })
    marketingUtilityResults.value.socialCalendar = data.result
    showToast('Social calendar generated')
  }

  async function generateMarketingDeliverable(type) {
    if (!generatedMarketingBrief.value) return showToast('Generate a marketing brief first', 'error')
    const data = await fetchJson('/api/marketing/deliverable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId: marketingDraft.value.workflowId,
        clientId: selectedClientForChat.value || selectedFinanceClient.value || null,
        type,
        target: marketingDraft.value.target,
        notes: marketingDraft.value.notes,
        brief: generatedMarketingBrief.value
      })
    })
    showToast(`${type === 'proposal' ? 'Proposal' : 'Report'} generated`)
    await Promise.all([
      loadMarketingOutputs(selectedClientForChat.value || selectedFinanceClient.value || ''),
      loadMarketingBriefs(selectedClientForChat.value || selectedFinanceClient.value || '')
    ])
    window.open(data.pdfUrl || data.url, '_blank')
  }

  function launchDeliverableToChat(item) {
    activeView.value = 'chat'
    promptInput.value = [
      `Continue from this marketing ${item.type || 'deliverable'} for workflow "${item.workflowId}".`,
      `Use the generated file at ${window.location.origin}${item.url}.`,
      'Turn it into the next client-ready execution plan and use the current client context if available.'
    ].join('\n')
  }

  async function sendMarketingDeliverable(item) {
    const data = await fetchJson(`/api/marketing/deliverable/${item.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    showToast(`Marketing file sent to ${data.sentTo}`)
  }

  function downloadMarketingDeliverable(item, format = 'md') {
    const link = document.createElement('a')
    link.href = `/api/marketing/deliverable/${item.id}/export?format=${format}`
    link.download = ''
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return {
    loadMarketingWorkflows,
    loadMarketingOutputs,
    loadMarketingBriefs,
    generateMarketingBrief,
    launchMarketingBrief,
    launchMarketingPreset,
    generateAuditBundle,
    launchAuditBundle,
    runPageAnalysis,
    runCompetitorScan,
    runSocialCalendar,
    generateMarketingDeliverable,
    launchDeliverableToChat,
    sendMarketingDeliverable,
    downloadMarketingDeliverable
  }
}
