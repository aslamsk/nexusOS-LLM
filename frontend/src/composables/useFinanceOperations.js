export function useFinanceOperations(options) {
  const {
    pnlPeriod,
    pnlReport,
    proactiveScanNiche,
    selectedFinanceClient,
    pricingCatalog,
    quotes,
    invoices,
    budgetSummary,
    quoteDraft,
    plannedAgencyQuote,
    agencyQuoteDraft,
    selectedAgencyServices,
    marketingBriefs,
    marketingOutputs,
    selectedClientForChat,
    marketingDraft,
    clients,
    fetchJson,
    showToast,
    loadMarketingBriefs,
    loadMarketingOutputs,
    buildAgencyScopePayload
  } = options

  async function loadPnlReport() {
    try {
      const data = await fetchJson(`/api/finance/pnl?period=${pnlPeriod.value}`)
      if (data && !data.error) pnlReport.value = data
    } catch (e) { console.warn('PnL load failed:', e) }
  }

  async function runProactiveScan() {
    if (!proactiveScanNiche.value.trim()) return showToast('Enter a niche to scan, Boss', 'error')
    showToast(`Scanning: ${proactiveScanNiche.value}`, 'success')
    try {
      await fetchJson('/api/proactive/propose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ niche: proactiveScanNiche.value }) })
    } catch (e) { showToast(`Scan failed: ${e.message}`, 'error') }
  }

  async function loadPricingCatalog() { pricingCatalog.value = (await fetchJson('/api/pricing/catalog')).catalog || {} }
  async function loadQuotes() { quotes.value = (await fetchJson(`/api/quotes${selectedFinanceClient.value ? `?clientId=${selectedFinanceClient.value}` : ''}`)).quotes || [] }
  async function loadInvoices() { invoices.value = (await fetchJson(`/api/invoices${selectedFinanceClient.value ? `?clientId=${selectedFinanceClient.value}` : ''}`)).invoices || [] }

  async function loadBudget() {
    if (!selectedFinanceClient.value) return
    budgetSummary.value = (await fetchJson(`/api/clients/${selectedFinanceClient.value}/budget`)).budget
  }

  async function ensureBudgetApproval(clientId) {
    if (!clientId) return true
    const budget = (await fetchJson(`/api/clients/${clientId}/budget`)).budget
    if (!budget.requiresBossApproval) return true
    return window.confirm(`This client is over budget by ${Math.abs(Number(budget.remaining || 0)).toFixed(2)}. Do you approve continuing anyway, Boss?`)
  }

  async function createQuote() {
    if (!selectedFinanceClient.value) return showToast('Select a client for finance actions, Boss', 'error')
    await fetchJson('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: selectedFinanceClient.value, ...quoteDraft.value })
    })
    showToast('Quote created')
    await Promise.all([loadQuotes(), loadBudget()])
  }

  async function previewAgencyQuote() {
    const payload = buildAgencyScopePayload()
    const data = await fetchJson('/api/quotes/planner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    plannedAgencyQuote.value = data.plan
    showToast('Agency quote plan prepared')
  }

  async function createAgencyQuote() {
    if (!selectedFinanceClient.value) return showToast('Select a client for finance actions, Boss', 'error')
    const payload = buildAgencyScopePayload()
    const data = await fetchJson('/api/quotes/planner/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: selectedFinanceClient.value, ...payload, notes: agencyQuoteDraft.value.notes })
    })
    plannedAgencyQuote.value = data.plan
    showToast('Agency quote created')
    await Promise.all([loadQuotes(), loadBudget()])
  }

  async function createInvoiceFromQuote(quoteId) {
    await fetchJson(`/api/invoices/from-quote/${quoteId}`, { method: 'POST' })
    showToast('Invoice generated')
    await Promise.all([loadQuotes(), loadInvoices(), loadBudget()])
  }

  async function markInvoicePaid(invoiceId) {
    await fetchJson(`/api/invoices/${invoiceId}/pay`, { method: 'POST' })
    showToast('Invoice marked paid')
    await Promise.all([loadInvoices(), loadBudget()])
  }

  function openFinanceMarketing(type = 'proposal') {
    options.activeView.value = 'marketing'
    options.generatedMarketingBrief.value = ''
    options.generatedAuditBundle.value = ''
    if (selectedFinanceClient.value) {
      selectedClientForChat.value = selectedFinanceClient.value
      const client = clients.value.find((item) => item.id === selectedFinanceClient.value)
      if (client) {
        marketingDraft.value.target = client.company || client.name
        if (!marketingDraft.value.notes) marketingDraft.value.notes = client.notes || ''
      }
    }
    marketingDraft.value.workflowId = type === 'proposal' ? 'proposal' : 'report'
    options.loadMarketingWorkflows()
    loadMarketingBriefs(selectedFinanceClient.value || '')
    loadMarketingOutputs(selectedFinanceClient.value || '')
  }

  function downloadInvoice(invoiceId, format) {
    const link = document.createElement('a')
    link.href = `/api/invoices/${invoiceId}/export?format=${format}`
    link.download = ''
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  function downloadQuote(quoteId, format) {
    const link = document.createElement('a')
    link.href = `/api/quotes/${quoteId}/export?format=${format}`
    link.download = ''
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  async function sendInvoice(invoiceId) {
    const data = await fetchJson(`/api/invoices/${invoiceId}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ includeMarketing: true }) })
    showToast(`Invoice sent to ${data.sentTo}`)
    await loadInvoices()
  }

  async function sendQuote(quoteId) {
    const data = await fetchJson(`/api/quotes/${quoteId}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    showToast(`Quote sent to ${data.sentTo}`)
    await loadQuotes()
  }

  async function updateSelectedFinanceClient(clientId) {
    selectedFinanceClient.value = clientId
    if (!clientId) return
    await Promise.allSettled([
      loadQuotes(),
      loadInvoices(),
      loadBudget(),
      loadMarketingBriefs(clientId),
      loadMarketingOutputs(clientId)
    ])
  }

  return {
    loadPnlReport,
    runProactiveScan,
    loadPricingCatalog,
    loadQuotes,
    loadInvoices,
    loadBudget,
    ensureBudgetApproval,
    createQuote,
    previewAgencyQuote,
    createAgencyQuote,
    createInvoiceFromQuote,
    markInvoicePaid,
    openFinanceMarketing,
    downloadInvoice,
    downloadQuote,
    sendInvoice,
    sendQuote,
    updateSelectedFinanceClient
  }
}
