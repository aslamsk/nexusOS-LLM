export function useSocketSession(options) {
  const {
    socket,
    sessionId,
    chatHistory,
    runtimeLogs,
    outputFiles,
    missionSummary,
    missionStatus,
    proactiveProposals,
    clientKeyLabels,
    scrollToBottom,
    notifyBossUpdate,
    fetchJson,
    loadClients,
    loadToolsDashboard,
    loadSetupCenter,
    loadSessionCatalog,
    loadSystemHealth,
    loadGlobalUsageSummary,
    loadPnlReport,
    syncViewport
  } = options

  async function mount() {
    syncViewport()
    window.addEventListener('resize', syncViewport)
    socket.emit('join_session', { sessionId: sessionId.value })
    socket.on('session_created', (data) => {
      sessionId.value = data.sessionId
      localStorage.setItem('nexus_session_id', data.sessionId)
    })
    socket.on('session_recovered', (data) => {
      sessionId.value = data.sessionId
      localStorage.setItem('nexus_session_id', data.sessionId)
      if (data.history?.length) chatHistory.value = data.history
      if (data.logs?.length) runtimeLogs.value = data.logs
    })
    socket.on('nexus_log', (data) => {
      runtimeLogs.value.push({ ...data, at: new Date().toISOString() })
      runtimeLogs.value = runtimeLogs.value.slice(-200)
      if (data.type === 'thought' || data.type === 'action') {
        const last = chatHistory.value.at(-1)
        const message = data.message || `Running ${data.name}`
        if (last && last.sender === 'nexus_thought') last.text = message
        else chatHistory.value.push({ sender: 'nexus_thought', text: message })
        if (data.type === 'action' && data.name) notifyBossUpdate('Nexus tool running', `Running ${data.name}`)
      } else if (data.type === 'result' && data.message) {
        chatHistory.value.push({ sender: 'nexus_result', text: String(data.message) })
        notifyBossUpdate('Nexus tool update', String(data.message).slice(0, 140))
      } else if (data.type === 'complete') {
        chatHistory.value.push({ sender: 'nexus', text: data.message || 'Mission completed.' })
        options.isWorking.value = false
        missionStatus.value = 'idle'
        loadSessionCatalog()
        notifyBossUpdate('Nexus mission complete', data.message || 'Mission completed.')
      } else if (data.type === 'pause' || data.type === 'input_requested' || data.type === 'approval_requested' || data.type === 'repair_suggested') {
        if (data.message) chatHistory.value.push({ sender: 'nexus_thought', text: data.message })
        options.isWorking.value = false
        missionStatus.value = 'paused'
        notifyBossUpdate('Nexus needs Boss input', data.message || 'A mission is waiting for your input.')
      } else if (data.type === 'error') {
        chatHistory.value.push({ sender: 'nexus_error', text: data.message || 'System error' })
        options.isWorking.value = false
        missionStatus.value = 'idle'
        loadSessionCatalog()
        notifyBossUpdate('Nexus error', data.message || 'A system error occurred.')
      }
      scrollToBottom()
    })
    socket.on('outputs_list', (data) => { outputFiles.value = data.files || [] })
    socket.on('mission_state', (data) => {
      missionSummary.value = data || missionSummary.value
      if (data?.activeRun) missionStatus.value = 'active'
      else if (data?.blocker || data?.pendingApproval || data?.pendingRequirement || data?.pendingRepair || data?.queue?.activeWaitingJobId) missionStatus.value = 'paused'
    })
    socket.on('proactive_proposal', (data) => {
      proactiveProposals.value.unshift({ ...data, receivedAt: new Date().toISOString() })
      proactiveProposals.value = proactiveProposals.value.slice(0, 20)
      if (data.type === 'new_client_onboarding') notifyBossUpdate('New Client!', data.message || 'A client has self-onboarded.')
      else notifyBossUpdate('Proactive Proposal', data.proposal?.slice(0, 100) || 'Market intelligence update.')
    })
    clientKeyLabels.value = (await fetchJson('/api/client-key-labels')).labels || {}
    await Promise.allSettled([loadClients(), loadToolsDashboard(), loadSetupCenter(), loadSessionCatalog(), loadSystemHealth(), loadGlobalUsageSummary(), loadPnlReport()])
  }

  function unmount() {
    window.removeEventListener('resize', syncViewport)
    socket.off('session_created')
    socket.off('session_recovered')
    socket.off('nexus_log')
    socket.off('outputs_list')
    socket.off('mission_state')
    socket.off('proactive_proposal')
  }

  return { mount, unmount }
}

