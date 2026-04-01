export function useChatShellActions(options) {
  const {
    socket,
    promptInput,
    isWorking,
    selectedClientForChat,
    setupDoctor,
    missionSummary,
    missionStatus,
    missionModeOverride,
    activeClientName,
    hasWaitingMission,
    activeView,
    chatHistory,
    runtimeLogs,
    outputFiles,
    isMobileNavOpen,
    selectedFinanceClient,
    generatedMarketingBrief,
    generatedAuditBundle,
    theme,
    alertsEnabled,
    setupPlaybooks,
    clientKeyInfo,
    fetchJson,
    showToast,
    ensureBudgetApproval,
    loadClients,
    loadPricingCatalog,
    loadQuotes,
    loadInvoices,
    loadPnlReport,
    loadBudget,
    loadMarketingWorkflows,
    loadMarketingBriefs,
    loadMarketingOutputs,
    loadToolsDashboard,
    loadSetupCenter,
    openSettings,
    scrollToBottom,
    isLikelyContinuationPrompt,
    clientKeyLabels,
    uploadedContextFiles = { value: [] }
  } = options

  async function handleFileUpload(payload) {
    const files = Array.isArray(payload)
      ? payload
      : Array.from(payload?.target?.files || payload?.dataTransfer?.files || [])
    if (!files.length) return
    const uploaded = []
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/upload', { method: 'POST', body: formData })
      const data = await response.json()
      if (!response.ok) {
        showToast(`Upload failed for ${file.name}`, 'error')
        continue
      }
      uploaded.push({
        name: data.originalName || data.filename || file.name,
        path: data.path,
        url: data.url,
        mimeType: data.mimeType || file.type || ''
      })
    }
    if (!uploaded.length) return
    uploadedContextFiles.value = [...uploadedContextFiles.value, ...uploaded]
    const promptLines = uploaded.map((item) => {
      const isImage = String(item.mimeType || '').startsWith('image/')
      const isVideo = String(item.mimeType || '').startsWith('video/')
      if (isImage || isVideo) return `[${isImage ? 'Uploaded image' : 'Uploaded video'}: ${item.name}](${item.url})\n[Context File Loaded: Path: \`${item.path}\`]`
      return `[Uploaded file: ${item.name}](${item.url})\n[Context File Loaded: Path: \`${item.path}\`]`
    })
    promptInput.value = `${promptInput.value}${promptInput.value ? '\n' : ''}${promptLines.join('\n')}`
    showToast(`${uploaded.length} file${uploaded.length > 1 ? 's' : ''} attached to mission context`)
  }

  async function submitTask() {
    const prompt = promptInput.value.trim()
    if (!prompt || isWorking.value) return
    try {
      const doctorData = await fetchJson(`/api/setup/doctor?prompt=${encodeURIComponent(prompt)}`)
      setupDoctor.value = doctorData.report || setupDoctor.value
      const blockers = (doctorData.report?.blockers || []).slice(0, 2)
      if (blockers.length) {
        const summary = blockers.map((item) => `${item.title}: ${item.detail}`).join(' | ')
        chatHistory.value.push({ sender: 'nexus_result', text: `Setup Doctor: ${summary}` })
        showToast(`Setup Doctor found ${blockers.length} relevant blocker${blockers.length > 1 ? 's' : ''}`, 'error')
      }
    } catch (_) {}
    const budgetApproved = await ensureBudgetApproval(selectedClientForChat.value || null)
    if (!budgetApproved) {
      showToast('Mission paused due to budget limit', 'error')
      return
    }
    const prefix = selectedClientForChat.value ? `[Client Context: ${activeClientName.value}] ` : ''
    chatHistory.value.push({ sender: 'user', text: `${prefix}${prompt}` })
    promptInput.value = ''
    uploadedContextFiles.value = []
    isWorking.value = true
    const isPaused = hasWaitingMission.value
    const hasExplicitBlocker = !!missionSummary.value.pendingApproval ||
      !!missionSummary.value.pendingRequirement ||
      !!missionSummary.value.pendingRepair ||
      !!missionSummary.value.blocker
    const shouldResumeExistingMission = isPaused && (hasExplicitBlocker || isLikelyContinuationPrompt(prompt))
    missionStatus.value = 'active'
    const missionMode = missionModeOverride.value === 'auto' ? null : missionModeOverride.value
    if (shouldResumeExistingMission) socket.emit('user_input', { prompt, clientId: selectedClientForChat.value || null, missionMode })
    else socket.emit('start_task', { prompt, clientId: selectedClientForChat.value || null, missionMode })
    scrollToBottom()
  }

  function useReplyChip(value) {
    promptInput.value = value
    submitTask()
  }

  function terminateTask() {
    socket.emit('stop_task')
    isWorking.value = false
    missionStatus.value = 'idle'
    chatHistory.value.push({ sender: 'nexus_error', text: 'Mission stopped by the Boss.' })
    scrollToBottom()
  }

  function startNewOrchestration() {
    // Prevent the next mount/reconnect from rejoining an old persisted session.
    localStorage.removeItem('nexus_session_id')
    socket.emit('start_new_session')
    chatHistory.value = [{ sender: 'nexus', text: 'Fresh session started, Boss. Define the next agency objective.' }]
    runtimeLogs.value = []
    outputFiles.value = []
    promptInput.value = ''
    uploadedContextFiles.value = []
    isWorking.value = false
    missionStatus.value = 'idle'
    missionSummary.value = {}
    activeView.value = 'chat'
  }

  function changeView(view) {
    activeView.value = view
    isMobileNavOpen.value = false
    if (view === 'clients') loadClients()
    if (view === 'finance') {
      loadPricingCatalog()
      loadQuotes()
      loadInvoices()
      loadPnlReport()
      if (selectedFinanceClient.value) loadBudget()
    }
    if (view === 'marketing') {
      loadMarketingWorkflows()
      loadMarketingBriefs(selectedClientForChat.value || selectedFinanceClient.value || '')
      loadMarketingOutputs(selectedClientForChat.value || selectedFinanceClient.value || '')
    }
    if (view === 'tools') loadToolsDashboard()
    if (view === 'setup') loadSetupCenter()
    if (view === 'settings') openSettings()
  }

  function openSettingsView() {
    changeView('settings')
  }

  function openToolsView() {
    changeView('tools')
  }

  function setClientChatContext(clientId) {
    activeView.value = 'chat'
    selectedClientForChat.value = clientId
  }

  function launchBriefToChat(brief) {
    promptInput.value = brief
    activeView.value = 'chat'
  }

  function setGeneratedMarketingBrief(value) {
    generatedMarketingBrief.value = value
  }

  function setGeneratedAuditBundle(value) {
    generatedAuditBundle.value = value
  }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function requeueJob(jobId) {
    socket.emit('requeue_job', { jobId })
  }

  function retryJobNow(jobId) {
    socket.emit('retry_now', { jobId })
  }

  async function enableNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return showToast('Notifications are not supported in this browser, Boss', 'error')
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return showToast('Notification permission was not granted', 'error')
    }
    const registration = await navigator.serviceWorker.ready
    registration.active?.postMessage({
      type: 'SHOW_NOTIFICATION',
      title: 'Nexus OS',
      body: 'Local notifications are active for the Boss.'
    })
    alertsEnabled.value = true
    localStorage.setItem('nexus_alerts_enabled', 'true')
    showToast('Notifications enabled')
  }

  async function notifyBossUpdate(title, body) {
    if (!alertsEnabled.value) return
    if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return
    const registration = await navigator.serviceWorker.ready
    registration.active?.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body
    })
  }

  function openKeySetupWithNexus(key) {
    const info = setupPlaybooks.value.find((item) => item.key === key) || clientKeyInfo[key] || clientKeyLabels.value[key]
    if (!info?.setupPrompt) return showToast('No guided setup flow is mapped for this key yet', 'error')
    activeView.value = 'chat'
    promptInput.value = info.setupPrompt
    showToast(`Setup mission prepared for ${info.label || info.title || key}`)
  }

  return {
    handleFileUpload,
    submitTask,
    useReplyChip,
    terminateTask,
    startNewOrchestration,
    changeView,
    openSettingsView,
    openToolsView,
    setClientChatContext,
    launchBriefToChat,
    setGeneratedMarketingBrief,
    setGeneratedAuditBundle,
    toggleTheme,
    requeueJob,
    retryJobNow,
    enableNotifications,
    notifyBossUpdate,
    openKeySetupWithNexus
  }
}
