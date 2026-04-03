import { computed } from 'vue'

export function useShellComputed(options) {
  const {
    navItems,
    activeView,
    clients,
    selectedClientForChat,
    toolsData,
    marketingWorkflows,
    marketingDraft,
    marketingOutputs,
    missionSummary,
    sessionCatalog,
    selectedAgencyServices,
    serviceSelectorOptions,
    globalUsageSummary,
    usageLeaders,
    runtimeLogs,
    activeMissionModeSource,
    chatHistory,
    missionStatus,
    llmStatusSource
  } = options

  const currentViewMeta = computed(() => navItems.find((item) => item.view === activeView.value) || navItems[0])
  const activeClientName = computed(() => clients.value.find((client) => client.id === selectedClientForChat.value)?.name || 'System Default')
  const activeIntegrationCount = computed(() => toolsData.value.filter((tool) => tool.status === 'active').length)
  const selectedMarketingWorkflow = computed(() => marketingWorkflows.value.find((workflow) => workflow.id === marketingDraft.value.workflowId) || null)
  const latestMarketingOutput = computed(() => marketingOutputs.value[0] || null)
  const latestRuns = computed(() => missionSummary.value.recentRuns.slice(0, 6))
  const latestSessions = computed(() => sessionCatalog.value.slice(0, 5))
  const recentAudit = computed(() => (missionSummary.value.auditTrail || []).slice(0, 6))
  const recentQueue = computed(() => (missionSummary.value.queue?.jobs || []).slice(0, 6))
  const recentRecovery = computed(() => (missionSummary.value.recoveryHistory || []).slice(0, 6))
  const visibleAgencyFields = computed(() => {
    const active = new Set(selectedAgencyServices.value || [])
    const fieldSet = new Set(['campaignName', 'profitMarginPct', 'taxPct', 'currency', 'notes'])
    serviceSelectorOptions.forEach((option) => {
      if (active.has(option.key)) option.fields.forEach((field) => fieldSet.add(field))
    })
    return fieldSet
  })
  const globalUsageChart = computed(() => {
    const rows = globalUsageSummary.value.daily || []
    const maxCalls = Math.max(...rows.map((row) => row.calls || 0), 1)
    return rows.slice(-14).map((row) => ({
      ...row,
      height: `${Math.max(10, Math.round(((row.calls || 0) / maxCalls) * 100))}%`
    }))
  })
  const recentProviderSwitches = computed(() => {
    return (missionSummary.value.recentRuns || [])
      .flatMap((run) => (run.providerSwitches || []).map((item) => ({
        ...item,
        runId: run.id,
        requestPreview: run.requestPreview
      })))
      .slice(0, 10)
  })
  const providerShareRows = computed(() => {
    const total = Math.max(globalUsageSummary.value.totals?.calls || 0, 1)
    return (globalUsageSummary.value.providers || []).slice(0, 6).map((provider) => ({
      ...provider,
      percentage: Math.round(((provider.calls || 0) / total) * 100)
    }))
  })
  const mostExpensiveModel = computed(() => {
    return [...(globalUsageSummary.value.models || [])]
      .sort((a, b) => Number(b.estimatedCostUsd || 0) - Number(a.estimatedCostUsd || 0))[0] || null
  })
  const mostExpensiveClient = computed(() => {
    return [...usageLeaders.value]
      .sort((a, b) => Number(b.estimatedCostUsd || 0) - Number(a.estimatedCostUsd || 0))[0] || null
  })
  const todayLiveUsage = computed(() => {
    const activeRun = missionSummary.value.activeRun || {}
    const providerUsage = Object.values(activeRun.providerUsage || {})
    const calls = providerUsage.reduce((sum, item) => sum + Number(item.calls || 0), 0)
    const paidCalls = providerUsage.reduce((sum, item) => sum + Number(item.paidCalls || 0), 0)
    const totalTokens = providerUsage.reduce((sum, item) => sum + Number(item.totalTokens || 0), 0)
    const inputTokens = providerUsage.reduce((sum, item) => sum + Number(item.inputTokens || 0), 0)
    const outputTokens = providerUsage.reduce((sum, item) => sum + Number(item.outputTokens || 0), 0)
    const estimatedCostUsd = providerUsage.reduce((sum, item) => sum + Number(item.estimatedCostUsd || 0), 0)
    return {
      calls,
      paidCalls,
      totalTokens,
      inputTokens,
      outputTokens,
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(6))
    }
  })
  const llmStatus = computed(() => {
    const provider = missionSummary.value.activeRun?.lastLlmProvider || llmStatusSource.provider
    const model = missionSummary.value.activeRun?.lastLlmModel || llmStatusSource.model
    const latestLlmStatusLog = [...runtimeLogs.value].reverse().find((entry) =>
      entry.type === 'thought' && String(entry.message || '').startsWith('LLM Status:')
    )
    const detail = latestLlmStatusLog
      ? String(latestLlmStatusLog.message || '').replace(/^LLM Status:\s*/, '').trim()
      : ''
    const lower = detail.toLowerCase()
    let badgeLabel = provider || 'AI'
    let badgeClass = 'success'

    if (lower.includes('retrying in') || lower.includes('quota/backoff')) {
      badgeLabel = 'Gemini waiting'
      badgeClass = 'warning'
    } else if (lower.includes('rotating to next key')) {
      badgeLabel = 'Gemini rotating'
      badgeClass = 'warning'
    } else if (lower.includes('fallback provider') || lower.includes('trying fallback provider')) {
      badgeLabel = 'Fallback active'
      badgeClass = 'warning'
    } else if (missionSummary.value.activeRun?.lastTool === 'browserAction' && missionStatus.value === 'active') {
      badgeLabel = 'Browser running'
      badgeClass = 'success'
    }

    return { provider, model, detail, badgeLabel, badgeClass }
  })
  const activeMissionMode = computed(() => missionSummary.value.missionMode || activeMissionModeSource)
  const pendingApprovalSummary = computed(() => {
    const pending = missionSummary.value.pendingApproval
    if (!pending?.details?.requestedMode) return null
    return {
      nextMode: String(pending.details.requestedMode || '').toUpperCase(),
      currentMode: String(pending.details.currentMode || activeMissionMode.value).toUpperCase(),
      tool: pending.details.tool || pending.toolCall?.name || 'execution',
      estimatedTools: pending.details.estimatedTools || [],
      likelyEngine: pending.details.likelyEngine || 'Nexus will choose the best engine for this step.',
      estimatedCostBand: pending.details.estimatedCostBand || 'unknown'
    }
  })
  const modeRoutingHint = computed(() => 'Direct execution is enabled. Nexus now pauses only for real approvals, risky actions, or missing setup.')
  const currentEngine = computed(() => {
    const latestEngineLog = [...runtimeLogs.value].reverse().find((entry) => entry.type === 'thought' && String(entry.message || '').startsWith('Execution engine:'))
    return latestEngineLog ? String(latestEngineLog.message || '').replace(/^Execution engine:\s*/, '') : 'Waiting for the next tool call.'
  })
  const engineThemeClass = computed(() => {
    const provider = String(llmStatus.value.provider || '').toLowerCase()
    if (provider.includes('openrouter')) return 'engine-openrouter'
    if (provider.includes('groq')) return 'engine-groq'
    if (provider.includes('nvidia')) return 'engine-nvidia'
    return 'engine-gemini'
  })
  const currentStage = computed(() => {
    const latest = runtimeLogs.value.at(-1)
    if (!latest) return { label: 'Idle', detail: 'Ready for the next mission.' }
    if (latest.type === 'step') return { label: 'Planning', detail: latest.message }
    if (latest.type === 'action') return { label: 'Executing Tool', detail: latest.name || 'Running tool' }
    if (latest.type === 'approval_requested') return { label: 'Awaiting Approval', detail: 'Boss confirmation required.' }
    if (latest.type === 'repair_suggested') return { label: 'Repair Mode', detail: 'Self-healing suggested a guided fix.' }
    if (latest.type === 'result') return { label: 'Reviewing Result', detail: 'Nexus is processing tool output.' }
    if (latest.type === 'error') return { label: 'Blocked', detail: latest.message || 'A system error occurred.' }
    return { label: 'Thinking', detail: latest.message || 'Mission is in progress.' }
  })
  const hasWaitingMission = computed(() => {
    return missionStatus.value === 'paused' ||
      !!missionSummary.value.pendingApproval ||
      !!missionSummary.value.pendingRequirement ||
      !!missionSummary.value.pendingRepair ||
      !!missionSummary.value.blocker ||
      !!missionSummary.value.queue?.activeWaitingJobId
  })
  const currentBlocker = computed(() => {
    if (pendingApprovalSummary.value) return null
    if (missionSummary.value.pendingApproval) return { title: 'Approval needed', detail: missionSummary.value.pendingApproval.reason || 'A high-risk action is waiting for Boss approval.' }
    if (missionSummary.value.pendingRequirement) return { title: 'Missing setup', detail: `Nexus needs: ${(missionSummary.value.pendingRequirement.keys || []).join(', ')}` }
    if (missionSummary.value.pendingRepair) return { title: 'Repair suggested', detail: missionSummary.value.pendingRepair.classification?.summary || 'Nexus has a guided repair suggestion.' }
    if (missionSummary.value.blocker) return { title: 'Waiting for input', detail: missionSummary.value.blocker.message || 'Nexus is waiting for clarification.' }
    return null
  })
  const latestNexusMessage = computed(() => {
    return [...chatHistory.value].reverse().find((entry) => String(entry.sender || '').startsWith('nexus'))?.text || ''
  })
  const suggestedReplyChips = computed(() => {
    const chips = []
    const latest = `${latestNexusMessage.value || ''}\n${currentBlocker.value?.detail || ''}`.toLowerCase()
    const addChip = (label, value = label) => {
      if (!chips.some((chip) => chip.value === value)) chips.push({ label, value })
    }
    if (missionSummary.value.pendingApproval) {
      addChip('Approve', 'yes')
      addChip('Reject', 'no')
    }
    if (missionSummary.value.pendingRepair) {
      addChip('Apply Repair', 'yes')
      addChip('Skip Repair', 'no')
    }
    if (missionSummary.value.pendingRequirement) {
      addChip('Cancel', 'cancel')
      const keys = missionSummary.value.pendingRequirement.keys || []
      if (keys.includes('META_PAGE_ID')) addChip('Use Current Page ID', 'use configured meta page id')
      if (keys.includes('META_ACCESS_TOKEN')) addChip('Use Saved Token', 'use configured meta access token')
    }
    const isChatMode = String(activeMissionMode.value || '').toLowerCase() === 'chat'
    const hasRecentAssistantContext = String(latestNexusMessage.value || '').trim().length > 0
    const hasBlockingState = !!missionSummary.value.pendingApproval || !!missionSummary.value.pendingRequirement || !!missionSummary.value.pendingRepair
    if (isChatMode && hasRecentAssistantContext && !hasBlockingState) {
      addChip('Now execute this')
      addChip('Switch to execute and do it')
      addChip('Continue this in execute mode')
    }
    if (latest.includes('organic') && latest.includes('paid')) {
      addChip('Organic Only', 'Use this as ORGANIC META POST only, not paid ads.')
      addChip('Organic + Paid', 'Create both organic content and paid ads.')
    }
    if (latest.includes('objective of your campaign') || latest.includes('campaign objective')) {
      ;['REACH', 'TRAFFIC', 'ENGAGEMENT', 'LEAD_GENERATION', 'CONVERSIONS'].forEach((value) => addChip(value, value))
    }
    if (latest.includes('could you please clarify') || latest.includes('waiting for clarification') || latest.includes('clarify')) {
      addChip('Continue', 'continue with the most relevant audience and proceed')
      addChip('Cancel', 'cancel')
    }
    if (!chips.length && hasWaitingMission.value) {
      addChip('Continue', 'continue')
      addChip('Cancel', 'cancel')
    }
    return chips.slice(0, 6)
  })

  return {
    currentViewMeta,
    activeClientName,
    activeIntegrationCount,
    selectedMarketingWorkflow,
    latestMarketingOutput,
    latestRuns,
    latestSessions,
    recentAudit,
    recentQueue,
    recentRecovery,
    visibleAgencyFields,
    globalUsageChart,
    recentProviderSwitches,
    providerShareRows,
    mostExpensiveModel,
    mostExpensiveClient,
    todayLiveUsage,
    llmStatus,
    activeMissionMode,
    pendingApprovalSummary,
    modeRoutingHint,
    currentEngine,
    engineThemeClass,
    currentStage,
    hasWaitingMission,
    currentBlocker,
    latestNexusMessage,
    suggestedReplyChips
  }
}


