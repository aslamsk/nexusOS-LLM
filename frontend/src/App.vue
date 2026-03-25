<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { io } from 'socket.io-client'

const socket = io()
const activeView = ref('chat')
const chatHistory = ref([{ sender: 'nexus', text: 'Mission control is online, Boss. Give me the objective.' }])
const runtimeLogs = ref([])
const sessionId = ref(localStorage.getItem('nexus_session_id'))
const promptInput = ref('')
const isWorking = ref(false)
const missionStatus = ref('idle')
const selectedClientForChat = ref('')
const chatContainer = ref(null)
const clients = ref([])
const toolsData = ref([])
const configEntries = ref([])
const configEdits = ref({})
const revealKeys = ref({})
const outputFiles = ref([])
const sessionCatalog = ref([])
const missionSummary = ref({ activeRun: null, recentRuns: [], totals: { missions: 0, successRate: 0, paused: 0, toolCalls: 0, llmCalls: 0, estimatedCostUsd: 0 }, queue: { jobs: [], totals: { queued: 0, paused: 0, completed: 0 } }, usage: { sessionEstimatedCostUsd: 0, completedJobs: 0 } })
const systemHealth = ref({ status: 'unknown', firestore: false })
const pricingCatalog = ref({})
const quotes = ref([])
const invoices = ref([])
const marketingWorkflows = ref([])
const marketingAuditSpecialists = ref([])
const marketingOutputs = ref([])
const marketingBriefs = ref([])
const generatedAuditBundle = ref('')
const marketingUtilityResults = ref({ pageAnalysis: null, competitorScan: null, socialCalendar: null })
const marketingDraft = ref({ workflowId: 'audit', target: '', notes: '', budget: '', channels: [] })
const generatedMarketingBrief = ref('')
const competitorInput = ref('')
const socialWeeks = ref(4)
const socialTheme = ref('')
const selectedFinanceClient = ref('')
const budgetSummary = ref({ allocated: 0, approvedOverage: 0, spent: 0, remaining: 0, requiresBossApproval: false })
const globalUsageSummary = ref({ totals: { calls: 0, freeCalls: 0, paidCalls: 0, estimatedCostUsd: 0 }, providers: [], models: [] })
const clientUsageSummary = ref({ totals: { calls: 0, freeCalls: 0, paidCalls: 0, estimatedCostUsd: 0 }, providers: [], models: [] })
const usagePeriod = ref('all')
const usageLeaders = ref([])
const missionModeOverride = ref('auto')
const agencyQuoteDraft = ref({
  campaignName: 'Agency growth package',
  bannerCount: 1,
  carouselCount: 0,
  videoCount: 0,
  contentDeliverables: 1,
  tagPackages: 1,
  reportCount: 1,
  auditCount: 0,
  metaAdsWeeks: 4,
  googleAdsWeeks: 0,
  linkedinAdsWeeks: 0,
  websiteProject: false,
  websitePages: 1,
  adSpendMonthly: 0,
  profitMarginPct: 35,
  taxPct: 0,
  currency: 'USD',
  includeStrategyRetainer: true,
  notes: ''
})
const selectedAgencyServices = ref(['banner_design', 'copywriting', 'tag_research', 'meta_ads_management', 'strategy_retainer'])
const plannedAgencyQuote = ref(null)
const quoteDraft = ref({
  items: [{ serviceCode: 'banner_design', quantity: 1 }],
  profitMarginPct: 35,
  taxPct: 0,
  currency: 'USD',
  notes: ''
})
const isAddingClient = ref(false)
const isManagingClientKeys = ref(false)
const isEditingTool = ref(false)
const activeClient = ref(null)
const activeTool = ref(null)
const clientKeysList = ref([])
const clientKeyEdits = ref({})
const clientKeyEditing = ref('')
const clientKeyLabels = ref({})
const fileInput = ref(null)
const isMobileNavOpen = ref(false)
const isSidebarCollapsed = ref(false)
const isRailCollapsed = ref(false)
const isSummaryVisible = ref(true)
const theme = ref(localStorage.getItem('nexus_theme') || 'light')
const brandLogoUrl = 'https://jarvis-test-89c81.web.app/assets/nexusOS_logo.png'
const newClient = ref({ name: '', company: '', email: '', phone: '', notes: '', initialKeys: {} })
const configToast = ref({ show: false, message: '', type: 'success' })
const alertsEnabled = ref(localStorage.getItem('nexus_alerts_enabled') === 'true')
const selectedQuotePreset = ref('custom')

const AGENCY_QUOTE_PRESETS = {
  custom: {
    label: 'Custom Scope',
    description: 'Start from a flexible mixed-service scope.'
  },
  creative_meta_boost: {
    label: 'Creative + Meta Boost',
    description: 'Banner, copy, tags, and 4-week Meta promotion.',
    values: { campaignName: 'Creative + Meta Boost', bannerCount: 1, carouselCount: 0, videoCount: 0, contentDeliverables: 1, tagPackages: 1, reportCount: 1, auditCount: 0, metaAdsWeeks: 4, googleAdsWeeks: 0, linkedinAdsWeeks: 0, websiteProject: false, websitePages: 1, adSpendMonthly: 0, includeStrategyRetainer: true }
  },
  website_google_launch: {
    label: 'Website + Google Launch',
    description: 'Website build plus initial Google promotion setup.',
    values: { campaignName: 'Website + Google Launch', bannerCount: 1, carouselCount: 0, videoCount: 0, contentDeliverables: 2, tagPackages: 1, reportCount: 1, auditCount: 1, metaAdsWeeks: 0, googleAdsWeeks: 4, linkedinAdsWeeks: 0, websiteProject: true, websitePages: 5, adSpendMonthly: 0, includeStrategyRetainer: true }
  },
  audit_report_ads: {
    label: 'Audit + Report + Ads',
    description: 'Audit, reporting, and ongoing ad management.',
    values: { campaignName: 'Audit + Report + Ads', bannerCount: 1, carouselCount: 1, videoCount: 0, contentDeliverables: 2, tagPackages: 1, reportCount: 2, auditCount: 1, metaAdsWeeks: 4, googleAdsWeeks: 0, linkedinAdsWeeks: 0, websiteProject: false, websitePages: 1, adSpendMonthly: 0, includeStrategyRetainer: true }
  },
  social_content_only: {
    label: 'Content + Promotion Only',
    description: 'Use existing creatives, charge only content, tags, and promotion service.',
    values: { campaignName: 'Content + Promotion Only', bannerCount: 0, carouselCount: 0, videoCount: 0, contentDeliverables: 4, tagPackages: 1, reportCount: 1, auditCount: 0, metaAdsWeeks: 4, googleAdsWeeks: 0, linkedinAdsWeeks: 0, websiteProject: false, websitePages: 1, adSpendMonthly: 0, includeStrategyRetainer: true }
  },
  website_content_ads: {
    label: 'Website + Content + Ads',
    description: 'Website project, launch content, and multi-channel promotion.',
    values: { campaignName: 'Website + Content + Ads', bannerCount: 2, carouselCount: 1, videoCount: 1, contentDeliverables: 4, tagPackages: 2, reportCount: 2, auditCount: 1, metaAdsWeeks: 4, googleAdsWeeks: 4, linkedinAdsWeeks: 0, websiteProject: true, websitePages: 6, adSpendMonthly: 0, includeStrategyRetainer: true }
  }
}

const navItems = [
  { view: 'chat', label: 'Mission Control', eyebrow: 'Live operations' },
  { view: 'clients', label: 'Clients', eyebrow: 'Contexts and keys' },
  { view: 'finance', label: 'Finance', eyebrow: 'Quotes and invoices' },
  { view: 'marketing', label: 'Marketing', eyebrow: 'Workflows and briefs' },
  { view: 'usage', label: 'Usage', eyebrow: 'Models and costs' },
  { view: 'setup', label: 'Setup Center', eyebrow: 'Provider onboarding' },
  { view: 'tools', label: 'Capabilities', eyebrow: 'Provider readiness' },
  { view: 'settings', label: 'Settings', eyebrow: 'System configuration' }
]

const SERVICE_SELECTOR_OPTIONS = [
  { key: 'banner_design', label: 'Banner Design', fields: ['bannerCount'] },
  { key: 'carousel_design', label: 'Carousel Ads', fields: ['carouselCount'] },
  { key: 'video_creative', label: 'Video Creative', fields: ['videoCount'] },
  { key: 'copywriting', label: 'Content / Captions', fields: ['contentDeliverables'] },
  { key: 'tag_research', label: 'Tags / Keywords', fields: ['tagPackages'] },
  { key: 'reporting_pack', label: 'Reports', fields: ['reportCount'] },
  { key: 'marketing_audit', label: 'Audit', fields: ['auditCount'] },
  { key: 'meta_ads_management', label: 'Meta Promotion', fields: ['metaAdsWeeks', 'adSpendMonthly'] },
  { key: 'google_ads_management', label: 'Google Promotion', fields: ['googleAdsWeeks', 'adSpendMonthly'] },
  { key: 'linkedin_ads_management', label: 'LinkedIn Promotion', fields: ['linkedinAdsWeeks', 'adSpendMonthly'] },
  { key: 'website_development', label: 'Website Development', fields: ['websiteProject', 'websitePages'] },
  { key: 'strategy_retainer', label: 'Strategy Retainer', fields: ['includeStrategyRetainer'] }
]

const CLIENT_KEY_INFO = {
  GEMINI_API_KEY: { label: 'Gemini API Key 1', placeholder: 'AIza...', howTo: 'Create in Google AI Studio for primary inference.', setupPrompt: 'Open Google AI Studio, create a Gemini API key for primary inference, and wait for my input if any login or confirmation is needed.' },
  GEMINI_API_KEY_2: { label: 'Gemini API Key 2', placeholder: 'AIza...', howTo: 'Create a second key for failover rotation.', setupPrompt: 'Open Google AI Studio and help me create a backup Gemini API key for failover rotation. Pause for my login or MFA input when needed, then continue.' },
  BRAVE_SEARCH_API_KEY: { label: 'Brave Search API Key', placeholder: 'BSA...', howTo: 'Create in Brave Search API dashboard.', setupPrompt: 'Open Brave Search API dashboard and guide me step by step to create a Brave Search API key. Pause for any login or payment inputs and continue after I reply.' },
  OPENROUTER_API_TOKEN: { label: 'OpenRouter API Token', placeholder: 'sk-or-...', howTo: 'Create in OpenRouter account settings for free fallback routing.', setupPrompt: 'Open OpenRouter account settings and guide me step by step to create an API token for Nexus fallback routing. Pause for any login or verification input and continue after I reply.' },
  OPENROUTER_MODEL: { label: 'OpenRouter Model', placeholder: 'openrouter/free', howTo: 'Set a free or preferred fallback model ID for OpenRouter.', setupPrompt: 'Help me choose and confirm the best OpenRouter fallback model for Nexus OS. Prefer a free model unless I ask otherwise.' },
  GROQ_API_KEY: { label: 'Groq API Key', placeholder: 'gsk_...', howTo: 'Create in Groq console for OpenAI-compatible fallback inference.', setupPrompt: 'Open the Groq console and guide me step by step to create a Groq API key for Nexus fallback inference. Pause for login or verification inputs and continue when I respond.' },
  GROQ_MODEL: { label: 'Groq Model', placeholder: 'llama-3.1-8b-instant', howTo: 'Optional fallback model id for Groq.', setupPrompt: 'Help me choose the best Groq fallback model for Nexus OS. Prefer a fast low-cost model unless I ask otherwise.' },
  NVIDIA_NIM_API_KEY: { label: 'NVIDIA NIM API Key', placeholder: 'nvapi-...', howTo: 'Create in NVIDIA Build / NIM API portal for fallback inference.', setupPrompt: 'Open NVIDIA Build / NIM and guide me step by step to create an API key for Nexus fallback inference. Pause for login or verification input and continue after I reply.' },
  NVIDIA_MODEL: { label: 'NVIDIA Model', placeholder: 'meta/llama-3.1-8b-instruct', howTo: 'Optional fallback model id for NVIDIA NIM.', setupPrompt: 'Help me choose the best NVIDIA NIM fallback model for Nexus OS. Prefer a stable instruct model unless I ask otherwise.' },
  META_ACCESS_TOKEN: { label: 'Meta Access Token', placeholder: 'EAA...', howTo: 'Use Meta Graph API tools to mint an access token.', setupPrompt: 'Open Meta Business / Graph API tools and guide me step by step to generate a Meta access token for Nexus OS. Pause for login, MFA, or page selection input and continue after I reply.' },
  META_AD_ACCOUNT_ID: { label: 'Meta Ad Account ID', placeholder: 'act_123', howTo: 'Copy the ad account id from Meta Business settings.', setupPrompt: 'Open Meta Business settings and help me locate the correct Meta ad account ID for this client. Pause for any login or account selection input and continue after I reply.' },
  GOOGLE_ADS_CLIENT_ID: { label: 'Google Ads Client ID', placeholder: 'app.googleusercontent.com', howTo: 'Create OAuth credentials in Google Cloud.', setupPrompt: 'Open Google Cloud Console and guide me step by step to create Google Ads OAuth client credentials for Nexus. Pause for login or consent screen input and continue after I reply.' },
  GOOGLE_ADS_CLIENT_SECRET: { label: 'Google Ads Client Secret', placeholder: 'GOCSPX...', howTo: 'Copy from the same OAuth credentials screen.', setupPrompt: 'Help me retrieve the Google Ads OAuth client secret from Google Cloud Console. Pause for login or navigation input if needed and continue after I reply.' },
  GMAIL_USER: { label: 'Gmail Address', placeholder: 'team@agency.com', howTo: 'Mailbox used for send and read actions.', setupPrompt: 'Help me confirm which Gmail account should be used for Nexus email sending and reading, and guide me through the setup if needed.' },
  GMAIL_APP_PASSWORD: { label: 'Gmail App Password', placeholder: '16-char app password', howTo: 'Generate from Google Account security settings.', setupPrompt: 'Open Google Account security settings and guide me step by step to generate a Gmail app password for Nexus OS. Pause for login, 2FA, or confirmation input and continue after I reply.' }
}

const CONFIG_FALLBACK_LABELS = {
  GEMINI_API_KEY: 'Gemini API Key 1 (Primary)',
  GEMINI_API_KEY_2: 'Gemini API Key 2 (Backup)',
  GEMINI_API_KEY_3: 'Gemini API Key 3 (Backup)',
  OPENROUTER_API_TOKEN: 'OpenRouter API Token',
  OPENROUTER_MODEL: 'OpenRouter Model',
  GROQ_API_KEY: 'Groq API Key',
  GROQ_MODEL: 'Groq Model',
  NVIDIA_NIM_API_KEY: 'NVIDIA NIM API Key',
  NVIDIA_MODEL: 'NVIDIA Model',
  BRAVE_SEARCH_API_KEY: 'Brave Search API Key (for Web Search)',
  GMAIL_USER: 'Gmail Address (for Email Tool)',
  GMAIL_APP_PASSWORD: 'Gmail App Password (for Email Tool)',
  WHATSAPP_PHONE_ID: 'WhatsApp Phone ID (from Meta Developer Portal)',
  META_ACCESS_TOKEN: 'Meta Access Token',
  META_AD_ACCOUNT_ID: 'Meta Ad Account ID',
  META_PAGE_ID: 'Meta Page ID',
  REPLICATE_API_TOKEN: 'Replicate API Token',
  LINKEDIN_ACCESS_TOKEN: 'LinkedIn Access Token',
  STRIPE_SECRET_KEY: 'Stripe Secret Key',
  APP_BASE_URL: 'Public App Base URL',
  GOOGLE_ADS_CLIENT_ID: 'Google Ads Client ID',
  GOOGLE_ADS_CLIENT_SECRET: 'Google Ads Client Secret',
  GOOGLE_ADS_REFRESH_TOKEN: 'Google Ads Refresh Token',
  GOOGLE_ADS_DEVELOPER_TOKEN: 'Google Ads Developer Token',
  QUOTA_MODE: 'Performance Mode (FREE, NORMAL, HIGH)'
}
const LLM_DEFAULT_VALUES = {
  OPENROUTER_MODEL: 'openrouter/free',
  GROQ_MODEL: 'llama-3.1-8b-instant',
  NVIDIA_MODEL: 'meta/llama-3.1-8b-instruct',
  QUOTA_MODE: 'FREE'
}

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
  SERVICE_SELECTOR_OPTIONS.forEach((option) => {
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
  const estimatedCostUsd = providerUsage.reduce((sum, item) => sum + Number(item.estimatedCostUsd || 0), 0)
  return {
    calls,
    paidCalls,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6))
  }
})
const llmStatus = computed(() => ({
  provider: missionSummary.value.activeRun?.lastLlmProvider || 'Gemini',
  model: missionSummary.value.activeRun?.lastLlmModel || 'gemini-2.5-flash'
}))
const activeMissionMode = computed(() => missionSummary.value.missionMode || 'discuss')
const planReadyApproval = computed(() => {
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
const modeRoutingHint = computed(() => {
  if (activeMissionMode.value === 'execute') {
    return 'Execute mode unlocks full tools and premium-capable providers for real work.'
  }
  if (activeMissionMode.value === 'plan') {
    return 'Plan mode prefers cheaper providers first and keeps expensive execution tools locked until approval.'
  }
  return 'Discuss mode keeps cost low, limits tools, and waits until Nexus has a clearer plan.'
})
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
const configGroups = computed(() => {
  const groups = [
    {
      title: 'Boss / Global LLM Defaults',
      keys: ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'OPENROUTER_API_TOKEN', 'OPENROUTER_MODEL', 'GROQ_API_KEY', 'GROQ_MODEL', 'NVIDIA_NIM_API_KEY', 'NVIDIA_MODEL', 'QUOTA_MODE']
    },
    {
      title: 'Channels and Outreach',
      keys: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_PAGE_ID', 'WHATSAPP_PHONE_ID', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'LINKEDIN_ACCESS_TOKEN']
    },
    {
      title: 'Search, Ads, Billing',
      keys: ['BRAVE_SEARCH_API_KEY', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_DEVELOPER_TOKEN', 'STRIPE_SECRET_KEY', 'APP_BASE_URL', 'REPLICATE_API_TOKEN']
    }
  ]
  return groups.map((group) => ({
    ...group,
    entries: group.keys.map((key) => configEntries.value.find((entry) => entry.key === key)).filter(Boolean)
  })).filter((group) => group.entries.length)
})
const priorityClientKeys = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'OPENROUTER_API_TOKEN', 'OPENROUTER_MODEL', 'GROQ_API_KEY', 'GROQ_MODEL', 'NVIDIA_NIM_API_KEY', 'NVIDIA_MODEL']
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
    !!missionSummary.value.pendingRepair ||
    !!missionSummary.value.blocker ||
    !!missionSummary.value.queue?.activeWaitingJobId
})
const currentBlocker = computed(() => {
  if (planReadyApproval.value) {
    return null
  }
  if (missionSummary.value.pendingApproval) {
    return { title: 'Approval needed', detail: missionSummary.value.pendingApproval.reason || 'A high-risk action is waiting for Boss approval.' }
  }
  if (missionSummary.value.pendingRequirement) {
    return { title: 'Missing setup', detail: `Nexus needs: ${(missionSummary.value.pendingRequirement.keys || []).join(', ')}` }
  }
  if (missionSummary.value.pendingRepair) {
    return { title: 'Repair suggested', detail: missionSummary.value.pendingRepair.classification?.summary || 'Nexus has a guided repair suggestion.' }
  }
  if (missionSummary.value.blocker) {
    return { title: 'Waiting for input', detail: missionSummary.value.blocker.message || 'Nexus is waiting for clarification.' }
  }
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
    if (planReadyApproval.value?.nextMode === 'EXECUTE') {
      addChip('Start Execution', 'yes')
      addChip('Stay In Plan', 'no')
    } else if (planReadyApproval.value?.nextMode === 'PLAN') {
      addChip('Start Planning', 'yes')
      addChip('Stay In Discuss', 'no')
    } else {
      addChip('Approve', 'yes')
      addChip('Reject', 'no')
    }
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
const usdToInrRate = 83.5
let syncTimeout = null

watch(theme, (value) => {
  document.documentElement.setAttribute('data-theme', value)
  localStorage.setItem('nexus_theme', value)
}, { immediate: true })

watch(chatHistory, () => {
  if (!sessionId.value) return
  clearTimeout(syncTimeout)
  syncTimeout = setTimeout(() => {
    socket.emit('sync_history', { history: JSON.parse(JSON.stringify(chatHistory.value)), logs: JSON.parse(JSON.stringify(runtimeLogs.value)) })
  }, 500)
}, { deep: true })

watch(selectedFinanceClient, async (value) => {
  if (!value) {
    marketingOutputs.value = []
    marketingBriefs.value = []
    clientUsageSummary.value = { totals: { calls: 0, freeCalls: 0, paidCalls: 0, estimatedCostUsd: 0 }, providers: [], models: [] }
    return
  }
  await Promise.allSettled([loadBudget(), loadQuotes(), loadInvoices(), loadMarketingBriefs(value), loadMarketingOutputs(value), loadClientUsageSummary(value)])
})

watch(selectedClientForChat, async (value) => {
  if (activeView.value !== 'marketing' || !value) return
  await Promise.allSettled([loadMarketingBriefs(value), loadMarketingOutputs(value)])
})

watch(usagePeriod, async () => {
  await refreshUsagePanels()
})

function showToast(message, type = 'success') {
  configToast.value = { show: true, message, type }
  setTimeout(() => { configToast.value.show = false }, 2600)
}

async function scrollToBottom() {
  await nextTick()
  if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight
}

function formatMessage(text) { return text ? text.replace(/\n/g, '<br>') : '' }
function prettyDate(value) { return value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : 'No timestamp' }
function dualCurrency(value) {
  const usd = Number(value || 0)
  const inr = usd * usdToInrRate
  return `$${usd.toFixed(2)} / Rs.${inr.toFixed(0)}`
}
async function fetchJson(url, options) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Request failed')
  return data
}

async function openSettings() {
  activeView.value = 'settings'
  const data = await fetchJson('/api/config')
  const incomingEntries = data.configs || []
  const entryMap = new Map(incomingEntries.map((entry) => [entry.key, entry]))
  for (const [key, label] of Object.entries(CONFIG_FALLBACK_LABELS)) {
    if (!entryMap.has(key)) {
      entryMap.set(key, { key, label, value: '', isSet: false })
    }
  }
  configEntries.value = Array.from(entryMap.values())
  const edits = {}, reveals = {}
  for (const entry of configEntries.value) {
    edits[entry.key] = entry.isSet ? entry.value : (LLM_DEFAULT_VALUES[entry.key] || '')
    reveals[entry.key] = false
  }
  configEdits.value = edits
  revealKeys.value = reveals
  await loadGlobalUsageSummary()
}

async function saveConfig() {
  const updates = {}
  for (const [key, value] of Object.entries(configEdits.value)) if (value !== '') updates[key] = value
  await fetchJson('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates }) })
  showToast('System configuration updated')
}

async function loadClients() { clients.value = (await fetchJson('/api/clients')).clients || [] }
async function loadGlobalUsageSummary() { globalUsageSummary.value = (await fetchJson(`/api/usage/summary?period=${encodeURIComponent(usagePeriod.value)}`)).summary || globalUsageSummary.value }
async function loadClientUsageSummary(clientId) {
  if (!clientId) {
    clientUsageSummary.value = { totals: { calls: 0, freeCalls: 0, paidCalls: 0, estimatedCostUsd: 0 }, providers: [], models: [] }
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
async function loadToolsDashboard() { toolsData.value = (await fetchJson('/api/system-status')).integrations || [] }
async function loadSessionCatalog() { sessionCatalog.value = (await fetchJson('/api/sessions')).sessions || [] }
async function loadSystemHealth() { systemHealth.value = await fetchJson('/api/health') }
async function loadPricingCatalog() { pricingCatalog.value = (await fetchJson('/api/pricing/catalog')).catalog || {} }
async function loadQuotes() { quotes.value = (await fetchJson(`/api/quotes${selectedFinanceClient.value ? `?clientId=${selectedFinanceClient.value}` : ''}`)).quotes || [] }
async function loadInvoices() { invoices.value = (await fetchJson(`/api/invoices${selectedFinanceClient.value ? `?clientId=${selectedFinanceClient.value}` : ''}`)).invoices || [] }
async function loadMarketingWorkflows() {
  const data = await fetchJson('/api/marketing/workflows')
  marketingWorkflows.value = data.workflows || []
  marketingAuditSpecialists.value = Object.entries(data.auditSpecialists || {}).map(([id, item]) => ({ id, ...item }))
}
async function loadMarketingOutputs(clientId = '') { marketingOutputs.value = (await fetchJson(`/api/marketing/outputs${clientId ? `?clientId=${clientId}` : ''}`)).outputs || [] }
async function loadMarketingBriefs(clientId = '') { marketingBriefs.value = (await fetchJson(`/api/marketing/briefs${clientId ? `?clientId=${clientId}` : ''}`)).briefs || [] }
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
    body: JSON.stringify({
      clientId: selectedFinanceClient.value,
      ...quoteDraft.value
    })
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
    body: JSON.stringify({
      clientId: selectedFinanceClient.value,
      ...payload,
      notes: agencyQuoteDraft.value.notes
    })
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
    body: JSON.stringify({
      target: marketingDraft.value.target,
      notes: marketingDraft.value.notes,
      channels: parsedChannels
    })
  })
  marketingUtilityResults.value.pageAnalysis = data.result
  showToast('Page analysis generated')
}

async function runCompetitorScan() {
  if (!marketingDraft.value.target) return showToast('Add a target brand or URL first', 'error')
  const data = await fetchJson('/api/marketing/competitor-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target: marketingDraft.value.target,
      competitors: competitorInput.value,
      notes: marketingDraft.value.notes
    })
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
    body: JSON.stringify({
      target: marketingDraft.value.target,
      channels: parsedChannels,
      weeks: socialWeeks.value,
      theme: socialTheme.value,
      notes: marketingDraft.value.notes
    })
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

function openFinanceMarketing(type = 'proposal') {
  activeView.value = 'marketing'
  generatedMarketingBrief.value = ''
  generatedAuditBundle.value = ''
  if (selectedFinanceClient.value) {
    selectedClientForChat.value = selectedFinanceClient.value
    const client = clients.value.find((item) => item.id === selectedFinanceClient.value)
    if (client) {
      marketingDraft.value.target = client.company || client.name
      if (!marketingDraft.value.notes) marketingDraft.value.notes = client.notes || ''
    }
  }
  marketingDraft.value.workflowId = type === 'proposal' ? 'proposal' : 'report'
  loadMarketingWorkflows()
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

function downloadMarketingDeliverable(item, format = 'md') {
  const link = document.createElement('a')
  link.href = `/api/marketing/deliverable/${item.id}/export?format=${format}`
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

async function saveClient() {
  if (!newClient.value.name.trim()) return showToast('Client name is required, Boss', 'error')
  for (const [key, value] of Object.entries(LLM_DEFAULT_VALUES)) {
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
  for (const [key, value] of Object.entries(LLM_DEFAULT_VALUES)) {
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

async function updateToolConfig() { await saveConfig(); isEditingTool.value = false; showToast(`${activeTool.value.name} guidance saved`) }
function testTool(tool) { activeView.value = 'chat'; promptInput.value = `Run a diagnostic on ${tool.name}. Validate readiness, note blockers, and give me the operational status.`; submitTask() }

async function handleFileUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch('/upload', { method: 'POST', body: formData })
  const data = await response.json()
  if (!response.ok) return showToast('Upload failed, Boss', 'error')
  promptInput.value = `${promptInput.value}${promptInput.value ? '\n' : ''}[Context File Loaded: Path: \`${data.path}\`]`
  showToast('File attached to mission context')
}

async function submitTask() {
  const prompt = promptInput.value.trim()
  if (!prompt || isWorking.value) return
  const budgetApproved = await ensureBudgetApproval(selectedClientForChat.value || null)
  if (!budgetApproved) {
    showToast('Mission paused due to budget limit', 'error')
    return
  }
  const prefix = selectedClientForChat.value ? `[Client Context: ${activeClientName.value}] ` : ''
  chatHistory.value.push({ sender: 'user', text: `${prefix}${prompt}` })
  promptInput.value = ''
  isWorking.value = true
  const isPaused = hasWaitingMission.value
  missionStatus.value = 'active'
  const missionMode = missionModeOverride.value === 'auto' ? null : missionModeOverride.value
  if (isPaused) socket.emit('user_input', { prompt, clientId: selectedClientForChat.value || null, missionMode })
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
  socket.emit('start_new_session')
  chatHistory.value = [{ sender: 'nexus', text: 'Fresh session started, Boss. Define the next agency objective.' }]
  runtimeLogs.value = []
  outputFiles.value = []
  promptInput.value = ''
  isWorking.value = false
  missionStatus.value = 'idle'
  activeView.value = 'chat'
}

function changeView(view) {
  activeView.value = view
  isMobileNavOpen.value = false
  if (view === 'clients') loadClients()
  if (view === 'finance') { loadPricingCatalog(); loadQuotes(); loadInvoices(); if (selectedFinanceClient.value) loadBudget() }
  if (view === 'marketing') { loadMarketingWorkflows(); loadMarketingBriefs(selectedClientForChat.value || selectedFinanceClient.value || ''); loadMarketingOutputs(selectedClientForChat.value || selectedFinanceClient.value || '') }
  if (view === 'tools') loadToolsDashboard()
  if (view === 'settings') openSettings()
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

function applyQuotePreset() {
  const preset = AGENCY_QUOTE_PRESETS[selectedQuotePreset.value]
  if (!preset?.values) return
  agencyQuoteDraft.value = {
    ...agencyQuoteDraft.value,
    ...preset.values
  }
  const serviceKeys = []
  if (agencyQuoteDraft.value.bannerCount > 0) serviceKeys.push('banner_design')
  if (agencyQuoteDraft.value.carouselCount > 0) serviceKeys.push('carousel_design')
  if (agencyQuoteDraft.value.videoCount > 0) serviceKeys.push('video_creative')
  if (agencyQuoteDraft.value.contentDeliverables > 0) serviceKeys.push('copywriting')
  if (agencyQuoteDraft.value.tagPackages > 0) serviceKeys.push('tag_research')
  if (agencyQuoteDraft.value.reportCount > 0) serviceKeys.push('reporting_pack')
  if (agencyQuoteDraft.value.auditCount > 0) serviceKeys.push('marketing_audit')
  if (agencyQuoteDraft.value.metaAdsWeeks > 0) serviceKeys.push('meta_ads_management')
  if (agencyQuoteDraft.value.googleAdsWeeks > 0) serviceKeys.push('google_ads_management')
  if (agencyQuoteDraft.value.linkedinAdsWeeks > 0) serviceKeys.push('linkedin_ads_management')
  if (agencyQuoteDraft.value.websiteProject) serviceKeys.push('website_development')
  if (agencyQuoteDraft.value.includeStrategyRetainer) serviceKeys.push('strategy_retainer')
  selectedAgencyServices.value = serviceKeys
  showToast(`${preset.label} preset applied`)
}

function toggleAgencyService(serviceKey) {
  const next = new Set(selectedAgencyServices.value)
  if (next.has(serviceKey)) next.delete(serviceKey)
  else next.add(serviceKey)
  selectedAgencyServices.value = [...next]
}

function buildAgencyScopePayload() {
  const active = new Set(selectedAgencyServices.value)
  return {
    campaignName: agencyQuoteDraft.value.campaignName,
    bannerCount: active.has('banner_design') ? Number(agencyQuoteDraft.value.bannerCount || 0) : 0,
    carouselCount: active.has('carousel_design') ? Number(agencyQuoteDraft.value.carouselCount || 0) : 0,
    videoCount: active.has('video_creative') ? Number(agencyQuoteDraft.value.videoCount || 0) : 0,
    contentDeliverables: active.has('copywriting') ? Number(agencyQuoteDraft.value.contentDeliverables || 0) : 0,
    tagPackages: active.has('tag_research') ? Number(agencyQuoteDraft.value.tagPackages || 0) : 0,
    reportCount: active.has('reporting_pack') ? Number(agencyQuoteDraft.value.reportCount || 0) : 0,
    auditCount: active.has('marketing_audit') ? Number(agencyQuoteDraft.value.auditCount || 0) : 0,
    metaAdsWeeks: active.has('meta_ads_management') ? Number(agencyQuoteDraft.value.metaAdsWeeks || 0) : 0,
    googleAdsWeeks: active.has('google_ads_management') ? Number(agencyQuoteDraft.value.googleAdsWeeks || 0) : 0,
    linkedinAdsWeeks: active.has('linkedin_ads_management') ? Number(agencyQuoteDraft.value.linkedinAdsWeeks || 0) : 0,
    websiteProject: active.has('website_development') ? Boolean(agencyQuoteDraft.value.websiteProject) : false,
    websitePages: active.has('website_development') ? Number(agencyQuoteDraft.value.websitePages || 1) : 1,
    adSpendMonthly: (active.has('meta_ads_management') || active.has('google_ads_management') || active.has('linkedin_ads_management')) ? Number(agencyQuoteDraft.value.adSpendMonthly || 0) : 0,
    profitMarginPct: Number(agencyQuoteDraft.value.profitMarginPct || 0),
    taxPct: Number(agencyQuoteDraft.value.taxPct || 0),
    currency: agencyQuoteDraft.value.currency,
    includeStrategyRetainer: active.has('strategy_retainer') ? Boolean(agencyQuoteDraft.value.includeStrategyRetainer) : false,
    notes: agencyQuoteDraft.value.notes
  }
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
  const info = CLIENT_KEY_INFO[key]
  if (!info?.setupPrompt) return showToast('No guided setup flow is mapped for this key yet', 'error')
  activeView.value = 'chat'
  promptInput.value = info.setupPrompt
  showToast(`Setup mission prepared for ${info.label}`)
}

onMounted(async () => {
  socket.emit('join_session', { sessionId: sessionId.value })
  socket.on('session_created', (data) => { sessionId.value = data.sessionId; localStorage.setItem('nexus_session_id', data.sessionId) })
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
      isWorking.value = false
      missionStatus.value = 'idle'
      loadSessionCatalog()
      notifyBossUpdate('Nexus mission complete', data.message || 'Mission completed.')
    } else if (data.type === 'pause' || data.type === 'input_requested' || data.type === 'approval_requested' || data.type === 'repair_suggested') {
      if (data.message) chatHistory.value.push({ sender: 'nexus_thought', text: data.message })
      isWorking.value = false
      missionStatus.value = 'paused'
      notifyBossUpdate('Nexus needs Boss input', data.message || 'A mission is waiting for your input.')
    } else if (data.type === 'error') {
      chatHistory.value.push({ sender: 'nexus_error', text: data.message || 'System error' })
      isWorking.value = false
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
    else if (data?.blocker || data?.pendingApproval || data?.pendingRepair || data?.queue?.activeWaitingJobId) missionStatus.value = 'paused'
  })
  clientKeyLabels.value = (await fetchJson('/api/client-key-labels')).labels || {}
  await Promise.allSettled([loadClients(), loadToolsDashboard(), loadSessionCatalog(), loadSystemHealth(), loadGlobalUsageSummary()])
})

onBeforeUnmount(() => {
  socket.off('session_created')
  socket.off('session_recovered')
  socket.off('nexus_log')
  socket.off('outputs_list')
  socket.off('mission_state')
})
</script>

<template>
  <div class="app-shell" :class="{ compact: isSidebarCollapsed, railHidden: isRailCollapsed }">
    <aside class="sidebar" :class="{ open: isMobileNavOpen, collapsed: isSidebarCollapsed }">
      <div class="brand">
        <!-- <div class="brand-mark">
          <img :src="brandLogoUrl" alt="Nexus OS icon" class="brand-icon-image" />
        </div> -->
        <div class="brand-copy">
          <img :src="brandLogoUrl" alt="Nexus OS" class="brand-logo-image" />
          <!-- <p class="brand-sub">Agency cockpit</p> -->
        </div>
      </div>
      <div class="sidebar-stack">
        <button v-for="item in navItems" :key="item.view" class="nav-item" :class="{ active: activeView === item.view }" @click="changeView(item.view)">
          <span class="nav-title">{{ item.label }}</span><span class="nav-sub">{{ item.eyebrow }}</span>
        </button>
      </div>
      <div class="sidebar-card"><span class="tiny-label">System - </span>
        <strong>{{ systemHealth.status }}</strong> <br><span class="tiny-copy">Firestore {{ systemHealth.firestore ? 'connected' : 'offline' }}</span></div>
      <div class="sidebar-card"> <br>
        <span class="tiny-label">Context - </span><strong>{{ activeClientName }}</strong> <br><span class="tiny-copy">Session {{ sessionId || 'pending' }}</span></div>
    </aside>

    <main class="workspace" :class="{ 'chat-mode': activeView === 'chat' }">
      <header class="topbar">
        <div><p class="eyebrow">{{ currentViewMeta.eyebrow }}</p><h1>{{ currentViewMeta.label }}</h1></div>
        <div class="action-row topbar-actions">
          <button class="ghost desktop-only" @click="isSidebarCollapsed = !isSidebarCollapsed">{{ isSidebarCollapsed ? 'Show Left' : 'Hide Left' }}</button>
          <button class="ghost desktop-only" @click="isRailCollapsed = !isRailCollapsed">{{ isRailCollapsed ? 'Show Right' : 'Hide Right' }}</button>
          <button v-if="!isRailCollapsed" class="ghost desktop-only" @click="isSummaryVisible = !isSummaryVisible">{{ isSummaryVisible ? 'Hide Overview' : 'Show Overview' }}</button>
          <button class="ghost mobile-secondary" @click="enableNotifications">Alerts</button>
          <button class="ghost mobile-secondary" @click="toggleTheme">{{ theme === 'dark' ? 'Light' : 'Dark' }}</button>
          <button class="ghost mobile-only" @click="isMobileNavOpen = !isMobileNavOpen">Menu</button>
          <button v-if="activeView === 'clients'" class="primary" @click="isAddingClient = true">Add Client</button>
          <button v-else class="primary" @click="startNewOrchestration">New Session</button>
        </div>
      </header>

      <section v-if="activeView !== 'chat'" class="hero-grid compact-bar" :class="{ expanded: isRailCollapsed, docked: !isRailCollapsed }">
        <article class="hero-card">
          <span class="tiny-label">Mission posture</span>
          <h2>{{ missionStatus === 'active' ? 'Operation in progress' : missionStatus === 'paused' ? 'Awaiting Boss input' : 'Ready for next mission' }}</h2>
          <p class="muted">Run client missions, review outputs, monitor queue health, and track estimated usage from one place.</p>
          <div class="pill-row"><span class="pill">{{ missionSummary.totals.missions }} missions</span><span class="pill">{{ missionSummary.totals.successRate }}% success</span><span class="pill">{{ activeIntegrationCount }} integrations</span><span class="pill">{{ dualCurrency(missionSummary.usage?.sessionEstimatedCostUsd || 0) }} est. cost</span></div>
        </article>
        <article class="metric-card compact-metric"><span class="tiny-label">Tools</span><strong>{{ missionSummary.totals.toolCalls }}</strong><p>Total calls</p></article>
        <article class="metric-card compact-metric"><span class="tiny-label">Queue</span><strong>{{ missionSummary.queue?.totals?.queued || 0 }}</strong><p>Waiting missions</p></article>
        <article class="metric-card compact-metric"><span class="tiny-label">Usage</span><strong>{{ missionSummary.totals.llmCalls || 0 }}</strong><p>LLM calls</p></article>
      </section>

      <section v-if="activeView === 'chat'" class="chat-layout">
        <div class="panel panel-chat">
          <div class="panel-head">
            <div><span class="tiny-label">Live mission</span><h3>Boss stream</h3></div>
                      <div class="stage-strip">
            <div class="stage-card">
              <span class="tiny-label">Stage</span>
              <strong>{{ currentStage.label }}</strong>
            </div>
            <div class="stage-card stage-detail">
              <span class="tiny-label">Status</span>
              <strong>{{ currentStage.detail }}</strong>
            </div>
            <div class="stage-card">
              <span class="tiny-label">Run State</span>
              <strong>{{ missionStatus === 'active' ? 'Mission running' : missionStatus === 'paused' ? 'Awaiting Boss' : 'Standing by' }}</strong>
            </div>
          </div>
            <div class="context-box"><label>Context</label><select v-model="selectedClientForChat"><option value="">System Default</option><option v-for="client in clients" :key="client.id" :value="client.id">{{ client.name }}</option></select></div>
          </div>
          <div class="mini-card engine-card" :class="engineThemeClass">
            <div class="run-head"><strong>Current engine</strong><span class="badge success">{{ llmStatus.provider }}</span></div>
            <p class="muted">{{ currentEngine }}</p>
            <p class="muted">LLM: {{ llmStatus.provider }} / {{ llmStatus.model }}</p>
            <p class="muted">Mode routing: {{ modeRoutingHint }}</p>
          </div>

          <div v-if="planReadyApproval" class="mini-card plan-ready-card">
            <div class="run-head"><strong>Plan Ready</strong><span class="badge warning">{{ planReadyApproval.currentMode }} -> {{ planReadyApproval.nextMode }}</span></div>
            <p class="muted">Nexus is ready to move from {{ planReadyApproval.currentMode }} to {{ planReadyApproval.nextMode }} for <strong>{{ planReadyApproval.tool }}</strong>.</p>
            <p class="muted">Likely engine: {{ planReadyApproval.likelyEngine }}</p>
            <p class="muted">Estimated cost band: {{ planReadyApproval.estimatedCostBand }}</p>
            <div v-if="planReadyApproval.estimatedTools.length" class="pill-row">
              <span v-for="tool in planReadyApproval.estimatedTools" :key="tool" class="pill">{{ tool }}</span>
            </div>
            <div class="action-row">
              <button class="primary subtle" @click="useReplyChip('yes')">{{ planReadyApproval.nextMode === 'EXECUTE' ? 'Start Execution' : 'Start Planning' }}</button>
              <button class="ghost" @click="useReplyChip('no')">{{ planReadyApproval.nextMode === 'EXECUTE' ? 'Stay In Plan' : 'Stay In Discuss' }}</button>
            </div>
          </div>

          <div v-if="currentBlocker" class="mini-card">
            <div class="run-head"><strong>{{ currentBlocker.title }}</strong><span class="badge warning">Action needed</span></div>
            <p class="muted">{{ currentBlocker.detail }}</p>
          </div>
          <div v-if="suggestedReplyChips.length" class="chip-row">
            <button v-for="chip in suggestedReplyChips" :key="chip.label + chip.value" class="chip-button" @click="useReplyChip(chip.value)">{{ chip.label }}</button>
          </div>
          <div ref="chatContainer" class="chat-stream">
            <div v-for="(msg, index) in chatHistory" :key="index" class="message-row" :class="msg.sender">
              <div class="message-card" :class="msg.sender"><span class="tiny-label">{{ msg.sender.startsWith('nexus') ? 'Nexus' : 'Boss' }}</span><div class="message-text" v-html="formatMessage(msg.text)"></div></div>
            </div>
          </div>
          <div class="composer">
            <div class="action-row"><button class="ghost" @click="fileInput.click()">Attach File</button><input ref="fileInput" type="file" class="hidden-input" @change="handleFileUpload" /></div>
            <textarea v-model="promptInput" placeholder="Describe the mission, expected result, and constraints." @keydown.enter.exact.prevent="submitTask"></textarea>
            <div class="action-row"><button v-if="isWorking || missionStatus === 'paused'" class="danger" @click="terminateTask">Stop</button><button v-else class="primary" @click="submitTask">Launch</button></div>
          </div>
        </div>
        <div class="rail" v-show="!isRailCollapsed">
          <div v-if="isSummaryVisible" class="panel summary-panel">
            <div class="panel-head"><div><span class="tiny-label">Operations</span><h3>Mission overview</h3></div></div>
            <div class="summary-scroll">
              <article class="hero-card summary-hero">
                <span class="tiny-label">Mission posture</span>
                <h2>{{ missionStatus === 'active' ? 'Operation in progress' : missionStatus === 'paused' ? 'Awaiting Boss input' : 'Ready for next mission' }}</h2>
                <p class="muted">Run client missions, review outputs, monitor queue health, and track estimated usage from one place.</p>
                <div class="pill-row">
                  <span class="pill">{{ missionSummary.totals.missions }} missions</span>
                  <span class="pill">{{ missionSummary.totals.successRate }}% success</span>
                  <span class="pill">{{ activeIntegrationCount }} integrations</span>
                  <span class="pill">{{ dualCurrency(missionSummary.usage?.sessionEstimatedCostUsd || 0) }} est. cost</span>
                </div>
              </article>
              <div class="summary-metrics">
                <article class="metric-card compact-metric"><span class="tiny-label">Tools</span><strong>{{ missionSummary.totals.toolCalls }}</strong><p>Total calls</p></article>
                <article class="metric-card compact-metric"><span class="tiny-label">Queue</span><strong>{{ missionSummary.queue?.totals?.queued || 0 }}</strong><p>Waiting missions</p></article>
                <article class="metric-card compact-metric"><span class="tiny-label">Usage</span><strong>{{ missionSummary.totals.llmCalls || 0 }}</strong><p>LLM calls</p></article>
              </div>
            </div>
          </div>
          <div v-if="missionSummary.pendingApproval" class="panel">
            <div class="panel-head"><div><span class="tiny-label">Approval gate</span><h3>Boss confirmation needed</h3></div></div>
            <div class="stack-item">
              <strong>{{ missionSummary.pendingApproval.toolCall?.name }}</strong>
              <p class="muted">{{ missionSummary.pendingApproval.reason }}</p>
              <p class="muted">{{ missionSummary.pendingApproval.preview }}</p>
              <pre v-if="missionSummary.pendingApproval.details" class="approval-json">{{ JSON.stringify(missionSummary.pendingApproval.details, null, 2) }}</pre>
            </div>
          </div>
          <div v-if="missionSummary.pendingRepair" class="panel">
            <div class="panel-head"><div><span class="tiny-label">Self-healing</span><h3>Repair mode suggested</h3></div></div>
            <div class="stack-item">
              <strong>{{ missionSummary.pendingRepair.classification?.type }}</strong>
              <p class="muted">{{ missionSummary.pendingRepair.classification?.summary }}</p>
              <p class="muted">{{ missionSummary.pendingRepair.playbook?.message }}</p>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><div><span class="tiny-label">Queue</span><h3>Durable mission queue</h3></div></div>
            <div v-if="recentQueue.length" class="stack-list"><div v-for="job in recentQueue" :key="job.id" class="stack-item"><div class="run-head"><strong>{{ job.prompt }}</strong><span class="badge" :class="job.status">{{ job.status }}</span></div><p class="muted">{{ prettyDate(job.createdAt) }} · {{ job.clientId || 'system' }}</p></div></div>
            <p v-else class="muted">Queued missions will appear here.</p>
          </div>
          <div class="panel">
            <div class="panel-head"><div><span class="tiny-label">Queue controls</span><h3>Replay and retry</h3></div></div>
            <div v-if="recentQueue.some(job => job.status === 'dead_letter' || job.status === 'cancelled' || job.status === 'failed' || job.status === 'retry_wait')" class="stack-list"><div v-for="job in recentQueue.filter(job => job.status === 'dead_letter' || job.status === 'cancelled' || job.status === 'failed' || job.status === 'retry_wait')" :key="job.id + '-control'" class="stack-item"><div class="run-head"><strong>{{ job.status }}</strong><span>{{ prettyDate(job.createdAt) }}</span></div><p class="muted">{{ job.prompt }}</p><div class="action-row" v-if="job.status === 'retry_wait'"><button class="ghost" @click="retryJobNow(job.id)">Retry Now</button></div><div class="action-row" v-else><button class="ghost" @click="requeueJob(job.id)">Requeue</button></div></div></div>
            <p v-else class="muted">No manual queue actions needed right now.</p>
          </div>
          <div class="panel">
            <div class="panel-head"><div><span class="tiny-label">LLM runtime</span><h3>Provider and model</h3></div></div>
            <div class="stack-item">
              <strong>{{ llmStatus.provider }}</strong>
              <p class="muted">{{ llmStatus.model }}</p>
            </div>
            <div class="stack-item">
              <strong>Mission mode</strong>
              <p class="muted">Active: {{ activeMissionMode.toUpperCase() }}</p>
              <div class="action-row">
                <select v-model="missionModeOverride">
                  <option value="auto">Auto</option>
                  <option value="discuss">Discuss</option>
                  <option value="plan">Plan</option>
                  <option value="execute">Execute</option>
                </select>
              </div>
            </div>
            <div class="stack-item">
              <strong>Live usage</strong>
              <p class="muted">{{ todayLiveUsage.calls }} model calls in this run · {{ todayLiveUsage.paidCalls }} paid-estimated</p>
              <p class="muted">{{ dualCurrency(todayLiveUsage.estimatedCostUsd || 0) }} current run est. cost</p>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><div><span class="tiny-label">Outputs</span><h3>Session files</h3></div><button class="ghost" @click="socket.emit('get_outputs')">Refresh</button></div>
            <div v-if="outputFiles.length" class="stack-list"><a v-for="file in outputFiles" :key="file.url" :href="file.url" target="_blank" rel="noreferrer" class="stack-item"><span>{{ file.name }}</span><span>Open</span></a></div>
            <p v-else class="muted">Generated files will appear here.</p>
          </div>
          <div class="panel">
            <div class="panel-head"><div><span class="tiny-label">Recent runs</span><h3>Execution quality</h3></div></div>
            <div v-if="latestRuns.length" class="stack-list"><div v-for="run in latestRuns" :key="run.id" class="stack-item"><div class="run-head"><strong>{{ run.requestPreview }}</strong><span class="badge" :class="run.status">{{ run.status }}</span></div><p class="muted">{{ prettyDate(run.startedAt) }} · {{ run.toolCalls || 0 }} tools · {{ run.steps || 0 }} steps · ${{ Number(run.estimatedCostUsd || 0).toFixed(4) }}</p><p class="muted">{{ run.lastLlmProvider || 'Gemini' }} / {{ run.lastLlmModel || 'gemini-2.5-flash' }}</p></div></div>
            <p v-else class="muted">No tracked runs yet.</p>
          </div>
          <div class="panel">
            <div class="panel-head"><div><span class="tiny-label">Audit trail</span><h3>High-risk actions</h3></div></div>
            <div v-if="recentAudit.length" class="stack-list"><div v-for="entry in recentAudit" :key="entry.at + entry.type" class="stack-item"><div class="run-head"><strong>{{ entry.type }}</strong><span>{{ prettyDate(entry.at) }}</span></div><p class="muted">{{ entry.payload?.tool || 'system' }}</p></div></div>
            <p v-else class="muted">No approval events recorded yet.</p>
          </div>
          <div class="panel">
            <div class="panel-head"><div><span class="tiny-label">Recovery log</span><h3>Self-healing memory</h3></div></div>
            <div v-if="recentRecovery.length" class="stack-list"><div v-for="entry in recentRecovery" :key="entry.at + entry.tool" class="stack-item"><div class="run-head"><strong>{{ entry.classification?.type }}</strong><span>{{ prettyDate(entry.at) }}</span></div><p class="muted">{{ entry.tool }}</p></div></div>
            <p v-else class="muted">No recovery events captured yet.</p>
          </div>
        </div>
      </section>

      <section v-else-if="activeView === 'clients'" class="grid-two">
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Client operations</span><h3>Accounts and isolated keys</h3></div><button class="ghost" @click="loadClients">Refresh</button></div>
          <div class="card-grid"><div v-for="client in clients" :key="client.id" class="mini-card"><div class="run-head"><strong>{{ client.name }}</strong><span class="badge success">{{ client.status || 'active' }}</span></div><p class="muted">{{ client.company || 'No organization listed' }}</p><p class="muted">{{ client.email || 'No email set' }}</p><div class="action-row"><button class="ghost" @click="manageClientKeys(client)">Keys</button><button class="ghost" @click="launchMarketingPreset(client)">Marketing</button><button class="primary subtle" @click="activeView = 'chat'; selectedClientForChat = client.id">Use Context</button></div></div></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Client usage</span><h3>Model usage by client</h3></div><div class="context-box"><label>Client</label><select v-model="selectedFinanceClient"><option value="">Select Client</option><option v-for="client in clients" :key="client.id" :value="client.id">{{ client.name }}</option></select></div></div>
          <div class="action-row"><select v-model="usagePeriod"><option value="all">All time</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select><button class="ghost" @click="refreshUsagePanels">Refresh Usage</button><button class="ghost" :disabled="!selectedFinanceClient" @click="downloadUsageReport('client', 'csv')">Export CSV</button><button class="ghost" :disabled="!selectedFinanceClient" @click="downloadUsageReport('client', 'pdf')">Export PDF</button></div>
          <div class="stack-list">
            <div class="stack-item"><strong>Total model calls</strong><p class="muted">{{ clientUsageSummary.totals.calls || 0 }} total · {{ clientUsageSummary.totals.freeCalls || 0 }} free · {{ clientUsageSummary.totals.paidCalls || 0 }} paid</p><p class="muted">{{ dualCurrency(clientUsageSummary.totals.estimatedCostUsd || 0) }} est. paid usage</p></div>
            <div v-if="clientUsageSummary.providers?.length" class="stack-item">
              <strong>Providers</strong>
            <p v-for="provider in clientUsageSummary.providers.slice(0, 6)" :key="provider.provider" class="muted">{{ provider.provider }} · {{ provider.calls }} calls · {{ provider.freeCalls }} free · {{ provider.paidCalls }} paid · {{ dualCurrency(provider.estimatedCostUsd || 0) }} · {{ provider.resetCadence }} · {{ Object.keys(provider.kinds || {}).join(' + ') || 'llm' }}</p>
            </div>
            <div v-if="clientUsageSummary.models?.length" class="stack-item">
              <strong>Models</strong>
            <p v-for="model in clientUsageSummary.models.slice(0, 8)" :key="`${model.provider}-${model.model}`" class="muted">{{ model.provider }} / {{ model.model }} · {{ model.calls }} calls · {{ model.freeCalls }} free · {{ model.paidCalls }} paid · {{ model.resetCadence }} · {{ model.kind || 'llm' }}</p>
            </div>
          </div>
          <p v-if="!selectedFinanceClient" class="muted">Select a client to view model usage totals and free vs paid estimates.</p>
        </div>
        <div class="panel"><div class="panel-head"><div><span class="tiny-label">Sessions</span><h3>Recent recoveries</h3></div></div><div v-if="latestSessions.length" class="stack-list"><div v-for="session in latestSessions" :key="session.id" class="stack-item"><strong>{{ session.preview }}</strong><p class="muted">{{ prettyDate(session.lastUpdated) }}</p></div></div><p v-else class="muted">Saved sessions will appear here.</p></div>
      </section>

      <section v-else-if="activeView === 'finance'" class="grid-two">
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Agency planner</span><h3>Recurring quote builder</h3></div></div>
          <div class="mini-card">
            <label>Preset package</label>
            <div class="run-head">
              <select v-model="selectedQuotePreset">
                <option v-for="(preset, key) in AGENCY_QUOTE_PRESETS" :key="key" :value="key">{{ preset.label }}</option>
              </select>
              <button class="ghost" @click="applyQuotePreset">Apply Preset</button>
            </div>
            <p class="muted">{{ AGENCY_QUOTE_PRESETS[selectedQuotePreset]?.description }}</p>
          </div>
          <div class="mini-card">
            <label>Service mix</label>
            <div class="pill-row selectable-pills">
              <button
                v-for="option in SERVICE_SELECTOR_OPTIONS"
                :key="option.key"
                class="pill selector-pill"
                :class="{ active: selectedAgencyServices.includes(option.key) }"
                @click="toggleAgencyService(option.key)"
              >
                {{ option.label }}
              </button>
            </div>
            <p class="muted">Mix design, marketing, development, reporting, and promotion services in one commercial quote.</p>
          </div>
          <div class="card-grid">
            <div class="mini-card"><label>Campaign</label><input v-model="agencyQuoteDraft.campaignName" placeholder="Monthly Meta ads package"></div>
            <div v-if="visibleAgencyFields.has('bannerCount')" class="mini-card"><label>Banner count</label><input v-model="agencyQuoteDraft.bannerCount" type="number" min="0"></div>
            <div v-if="visibleAgencyFields.has('carouselCount')" class="mini-card"><label>Carousel count</label><input v-model="agencyQuoteDraft.carouselCount" type="number" min="0"></div>
            <div v-if="visibleAgencyFields.has('videoCount')" class="mini-card"><label>Video count</label><input v-model="agencyQuoteDraft.videoCount" type="number" min="0"></div>
            <div v-if="visibleAgencyFields.has('contentDeliverables')" class="mini-card"><label>Content deliverables</label><input v-model="agencyQuoteDraft.contentDeliverables" type="number" min="0"></div>
            <div v-if="visibleAgencyFields.has('tagPackages')" class="mini-card"><label>Tag / hashtag packs</label><input v-model="agencyQuoteDraft.tagPackages" type="number" min="0"></div>
            <div v-if="visibleAgencyFields.has('reportCount')" class="mini-card"><label>Reports</label><input v-model="agencyQuoteDraft.reportCount" type="number" min="0"></div>
            <div v-if="visibleAgencyFields.has('auditCount')" class="mini-card"><label>Audits</label><input v-model="agencyQuoteDraft.auditCount" type="number" min="0"></div>
            <div v-if="visibleAgencyFields.has('metaAdsWeeks')" class="mini-card"><label>Meta ads weeks</label><input v-model="agencyQuoteDraft.metaAdsWeeks" type="number" min="0"></div>
            <div v-if="visibleAgencyFields.has('googleAdsWeeks')" class="mini-card"><label>Google ads weeks</label><input v-model="agencyQuoteDraft.googleAdsWeeks" type="number" min="0"></div>
            <div v-if="visibleAgencyFields.has('linkedinAdsWeeks')" class="mini-card"><label>LinkedIn ads weeks</label><input v-model="agencyQuoteDraft.linkedinAdsWeeks" type="number" min="0"></div>
            <div v-if="visibleAgencyFields.has('websiteProject')" class="mini-card"><label>Website project</label><select v-model="agencyQuoteDraft.websiteProject"><option :value="false">No</option><option :value="true">Yes</option></select></div>
            <div v-if="visibleAgencyFields.has('websitePages')" class="mini-card"><label>Website pages</label><input v-model="agencyQuoteDraft.websitePages" type="number" min="1"></div>
            <div v-if="visibleAgencyFields.has('adSpendMonthly')" class="mini-card"><label>Ad spend / month</label><input v-model="agencyQuoteDraft.adSpendMonthly" type="number" min="0" step="0.01"></div>
            <div class="mini-card"><label>Profit %</label><input v-model="agencyQuoteDraft.profitMarginPct" type="number" min="0"></div>
            <div class="mini-card"><label>Tax %</label><input v-model="agencyQuoteDraft.taxPct" type="number" min="0"></div>
            <div class="mini-card"><label>Currency</label><select v-model="agencyQuoteDraft.currency"><option value="USD">USD</option><option value="INR">INR</option></select></div>
            <div v-if="visibleAgencyFields.has('includeStrategyRetainer')" class="mini-card"><label>Strategy retainer</label><select v-model="agencyQuoteDraft.includeStrategyRetainer"><option :value="true">Yes</option><option :value="false">No</option></select></div>
            <div class="mini-card full"><label>Notes</label><textarea v-model="agencyQuoteDraft.notes" placeholder="Client scope, exclusions, launch window, offer notes, approval terms."></textarea></div>
          </div>
          <div class="action-row"><button class="ghost" @click="previewAgencyQuote">Preview Plan</button><button class="primary" @click="createAgencyQuote">Create Agency Quote</button></div>
          <div v-if="plannedAgencyQuote" class="stack-list">
            <div class="stack-item"><strong>{{ plannedAgencyQuote.title }}</strong><p class="muted">Banners {{ plannedAgencyQuote.summary.bannerCount }} · Carousels {{ plannedAgencyQuote.summary.carouselCount }} · Videos {{ plannedAgencyQuote.summary.videoCount }} · Content {{ plannedAgencyQuote.summary.contentDeliverables }}</p><p class="muted">Channels: {{ (plannedAgencyQuote.summary.activeChannels || []).join(', ') || 'No paid promotion selected' }}</p><p class="muted">AI ops estimate: {{ dualCurrency(plannedAgencyQuote.aiOps.totalCost || 0) }} · Nexus platform fee: {{ dualCurrency(plannedAgencyQuote.platformFee || 0) }}</p><p class="muted">Quoted total: {{ dualCurrency(plannedAgencyQuote.pricing?.total || 0) }}</p></div>
            <div class="stack-item"><strong>Assumptions</strong><p v-for="line in plannedAgencyQuote.assumptions" :key="line" class="muted">{{ line }}</p></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Finance</span><h3>Quote and invoice control</h3></div><div class="context-box"><label>Client</label><select v-model="selectedFinanceClient" @change="loadQuotes(); loadInvoices(); loadBudget(); loadMarketingBriefs(selectedFinanceClient); loadMarketingOutputs(selectedFinanceClient)"><option value="">Select Client</option><option v-for="client in clients" :key="client.id" :value="client.id">{{ client.name }}</option></select></div></div>
          <div class="card-grid">
            <div class="mini-card"><label>Service</label><select v-model="quoteDraft.items[0].serviceCode"><option v-for="(info, code) in pricingCatalog" :key="code" :value="code">{{ info.label }}</option></select></div>
            <div class="mini-card"><label>Quantity</label><input v-model="quoteDraft.items[0].quantity" type="number" min="1"></div>
            <div class="mini-card"><label>Profit %</label><input v-model="quoteDraft.profitMarginPct" type="number" min="0"></div>
            <div class="mini-card"><label>Tax %</label><input v-model="quoteDraft.taxPct" type="number" min="0"></div>
            <div class="mini-card full"><label>Notes</label><textarea v-model="quoteDraft.notes" placeholder="Scope, timelines, add-ons, approval notes."></textarea></div>
          </div>
          <div class="action-row"><button class="primary" @click="createQuote">Create Quote</button></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Budget</span><h3>Client budget status</h3></div></div>
          <div class="stack-list">
            <div class="stack-item"><strong>Allocated</strong><p class="muted">{{ dualCurrency(budgetSummary.allocated || 0) }}</p></div>
            <div class="stack-item"><strong>Approved Overage</strong><p class="muted">{{ dualCurrency(budgetSummary.approvedOverage || 0) }}</p></div>
            <div class="stack-item"><strong>Spent</strong><p class="muted">{{ dualCurrency(budgetSummary.spent || 0) }}</p></div>
            <div class="stack-item"><strong>Remaining</strong><p class="muted">{{ dualCurrency(budgetSummary.remaining || 0) }}</p><p v-if="budgetSummary.requiresBossApproval" class="muted">Boss approval required for excess work.</p></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Quotes</span><h3>Prepared offers</h3></div></div>
          <div v-if="quotes.length" class="stack-list"><div v-for="quote in quotes.slice(0, 6)" :key="quote.id" class="stack-item"><div class="run-head"><strong>{{ quote.planner?.campaignName || quote.pricing?.items?.[0]?.description || 'Quote' }}</strong><span class="badge">{{ quote.status }}</span></div><p class="muted">{{ dualCurrency(quote.pricing?.total || 0) }}</p><div class="action-row"><button class="ghost" @click="downloadQuote(quote.id, 'pdf')">PDF</button><button class="ghost" @click="downloadQuote(quote.id, 'csv')">Excel</button><button class="ghost" @click="sendQuote(quote.id)">Send</button><button class="ghost" @click="createInvoiceFromQuote(quote.id)">Create Invoice</button></div></div></div>
          <p v-else class="muted">No quotes yet.</p>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Marketing delivery</span><h3>Proposal and report bridge</h3></div></div>
          <div class="stack-list">
            <div class="stack-item">
              <strong>Client-facing documents</strong>
              <p class="muted">Generate professional proposals and reports from the selected client context, then route them into finance or mission execution.</p>
              <div class="action-row"><button class="ghost" @click="openFinanceMarketing('proposal')">New Proposal</button><button class="ghost" @click="openFinanceMarketing('report')">New Report</button></div>
            </div>
            <div v-if="latestMarketingOutput" class="stack-item">
              <strong>Latest marketing output</strong>
              <p class="muted">{{ latestMarketingOutput.fileName }}</p>
              <div class="action-row"><button class="ghost" @click="downloadMarketingDeliverable(latestMarketingOutput, 'pdf')">PDF</button><button class="ghost" @click="launchDeliverableToChat(latestMarketingOutput)">Use In Mission</button><button class="ghost" @click="sendMarketingDeliverable(latestMarketingOutput)">Send To Client</button></div>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Invoices</span><h3>Payment status</h3></div></div>
          <div v-if="invoices.length" class="stack-list"><div v-for="invoice in invoices.slice(0, 6)" :key="invoice.id" class="stack-item"><div class="run-head"><strong>Invoice {{ invoice.id.slice(0, 8) }}</strong><span class="badge" :class="invoice.status === 'paid' ? 'success' : 'warning'">{{ invoice.status }}</span></div><p class="muted">{{ dualCurrency(invoice.pricing?.total || 0) }} · <a :href="invoice.paymentUrl" target="_blank" rel="noreferrer">Pay</a></p><div class="action-row"><button class="ghost" @click="downloadInvoice(invoice.id, 'pdf')">PDF</button><button class="ghost" @click="downloadInvoice(invoice.id, 'csv')">Excel</button><button class="ghost" @click="sendInvoice(invoice.id)">Send</button><button v-if="invoice.status !== 'paid'" class="ghost" @click="markInvoicePaid(invoice.id)">Mark Paid</button></div></div></div>
          <p v-else class="muted">No invoices yet.</p>
        </div>
      </section>

      <section v-else-if="activeView === 'marketing'" class="grid-two">
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Marketing</span><h3>Nexus workflow builder</h3></div><button class="ghost" @click="loadMarketingWorkflows">Refresh</button></div>
          <div v-if="selectedMarketingWorkflow" class="mini-card full">
            <div class="run-head"><strong>{{ selectedMarketingWorkflow.label }}</strong><span class="badge">{{ selectedMarketingWorkflow.category }}</span></div>
            <p class="muted">{{ selectedMarketingWorkflow.description }}</p>
            <p class="muted">Expected output: {{ selectedMarketingWorkflow.output }}</p>
          </div>
          <div v-if="marketingDraft.workflowId === 'audit' && marketingAuditSpecialists.length" class="mini-card full">
            <div class="panel-head"><div><span class="tiny-label">Audit mode</span><h3>Multi-specialist structure</h3></div></div>
            <div class="card-grid">
              <div v-for="specialist in marketingAuditSpecialists" :key="specialist.id" class="stack-item">
                <div class="run-head"><strong>{{ specialist.label }}</strong><span>{{ specialist.id }}</span></div>
                <p class="muted">{{ specialist.focus.join(', ') }}</p>
                <p class="muted">{{ specialist.deliverable }}</p>
              </div>
            </div>
            <div class="action-row"><button class="ghost" @click="generateAuditBundle">Generate Audit Bundle</button><button class="ghost" @click="launchAuditBundle">Launch Audit Bundle</button></div>
          </div>
          <div class="card-grid">
            <div class="mini-card">
              <label>Workflow</label>
              <select v-model="marketingDraft.workflowId">
                <option v-for="workflow in marketingWorkflows" :key="workflow.id" :value="workflow.id">{{ workflow.label }}</option>
              </select>
            </div>
            <div class="mini-card">
              <label>Target URL / Topic</label>
              <input v-model="marketingDraft.target" placeholder="https://clientsite.com or offer/topic">
            </div>
            <div class="mini-card">
              <label>Budget</label>
              <input v-model="marketingDraft.budget" placeholder="$2,000 monthly or Rs. 1,50,000">
            </div>
            <div class="mini-card full">
              <label>Channels</label>
              <input v-model="marketingDraft.channels" placeholder="Meta Ads, Google Ads, Email, LinkedIn">
              <p class="muted">Separate channels with commas.</p>
            </div>
            <div class="mini-card full">
              <label>Notes</label>
              <textarea v-model="marketingDraft.notes" placeholder="Goals, offer details, audience, constraints, deliverable expectations."></textarea>
            </div>
          </div>
          <div class="action-row"><button class="primary" @click="generateMarketingBrief()">Generate Brief</button></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Generated brief</span><h3>Mission-ready prompt</h3></div></div>
          <div class="mini-card">
            <textarea v-model="generatedMarketingBrief" placeholder="Generated marketing workflow brief will appear here."></textarea>
            <div class="action-row"><button class="ghost" @click="launchMarketingBrief">Send To Mission Control</button><button class="ghost" @click="generateMarketingDeliverable('report')">Generate Report</button><button class="ghost" @click="generateMarketingDeliverable('proposal')">Generate Proposal</button></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Utilities</span><h3>Marketing utility tools</h3></div></div>
          <div class="card-grid">
            <div class="mini-card">
              <label>Page analysis</label>
              <p class="muted">Generate a structured page-readiness snapshot from the current target and notes.</p>
              <div class="action-row"><button class="ghost" @click="runPageAnalysis">Run</button></div>
              <p v-if="marketingUtilityResults.pageAnalysis" class="muted">{{ marketingUtilityResults.pageAnalysis.summary }}</p>
            </div>
            <div class="mini-card">
              <label>Competitors</label>
              <input v-model="competitorInput" placeholder="competitor.com, brand two, brand three">
              <div class="action-row"><button class="ghost" @click="runCompetitorScan">Scan</button></div>
              <p v-if="marketingUtilityResults.competitorScan" class="muted">{{ marketingUtilityResults.competitorScan.summary }}</p>
            </div>
            <div class="mini-card">
              <label>Social theme</label>
              <input v-model="socialTheme" placeholder="Launch week, trust campaign, lead gen offer">
              <label>Weeks</label>
              <input v-model="socialWeeks" type="number" min="1" max="12">
              <div class="action-row"><button class="ghost" @click="runSocialCalendar">Generate Calendar</button></div>
              <p v-if="marketingUtilityResults.socialCalendar" class="muted">{{ marketingUtilityResults.socialCalendar.summary }}</p>
            </div>
          </div>
        </div>
        <div v-if="marketingDraft.workflowId === 'audit'" class="panel">
          <div class="panel-head"><div><span class="tiny-label">Audit bundle</span><h3>Five-specialist mission pack</h3></div></div>
          <div class="mini-card">
            <textarea v-model="generatedAuditBundle" placeholder="Generated multi-specialist audit bundle will appear here."></textarea>
            <div class="action-row"><button class="ghost" @click="launchAuditBundle">Send Audit To Mission Control</button></div>
          </div>
        </div>
        <div v-if="marketingUtilityResults.pageAnalysis || marketingUtilityResults.competitorScan || marketingUtilityResults.socialCalendar" class="panel">
          <div class="panel-head"><div><span class="tiny-label">Utility outputs</span><h3>Structured marketing insights</h3></div></div>
          <div class="stack-list">
            <div v-if="marketingUtilityResults.pageAnalysis" class="stack-item">
              <div class="run-head"><strong>Page analysis</strong><span>{{ marketingUtilityResults.pageAnalysis.page?.hostname || marketingDraft.target }}</span></div>
              <p class="muted">{{ marketingUtilityResults.pageAnalysis.findings?.map((item) => `${item.label}: ${item.score}/10`).join(' · ') }}</p>
            </div>
            <div v-if="marketingUtilityResults.competitorScan" class="stack-item">
              <div class="run-head"><strong>Competitor scan</strong><span>{{ marketingUtilityResults.competitorScan.competitorCount }} competitors</span></div>
              <p class="muted">{{ marketingUtilityResults.competitorScan.rows?.slice(0, 2).map((item) => `${item.competitor}: ${item.opportunity}`).join(' | ') }}</p>
            </div>
            <div v-if="marketingUtilityResults.socialCalendar" class="stack-item">
              <div class="run-head"><strong>Social calendar</strong><span>{{ marketingUtilityResults.socialCalendar.weeks }} weeks</span></div>
              <p class="muted">{{ marketingUtilityResults.socialCalendar.posts?.slice(0, 2).map((item) => `${item.hook} (${item.format})`).join(' | ') }}</p>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Brief memory</span><h3>Saved marketing briefs</h3></div></div>
          <div v-if="marketingBriefs.length" class="stack-list"><div v-for="item in marketingBriefs.slice(0, 6)" :key="item.id" class="stack-item"><div class="run-head"><strong>{{ item.workflowId }}</strong><span>{{ prettyDate(item.createdAt?.seconds ? item.createdAt.seconds * 1000 : item.createdAt) }}</span></div><p class="muted">{{ item.target || 'No target specified' }}</p><div class="action-row"><button class="ghost" @click="generatedMarketingBrief = item.brief">Load Brief</button><button class="ghost" @click="promptInput = item.brief; activeView = 'chat'">Launch</button></div></div></div>
          <p v-else class="muted">Saved workflow briefs will appear here.</p>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Deliverables</span><h3>Generated marketing files</h3></div></div>
          <div v-if="marketingOutputs.length" class="stack-list"><div v-for="item in marketingOutputs.slice(0, 8)" :key="item.id || item.url" class="stack-item"><div class="run-head"><strong>{{ item.type }}</strong><span>{{ item.workflowId }}</span></div><p class="muted">{{ item.fileName }}</p><div class="action-row"><a :href="item.url" target="_blank" rel="noreferrer" class="link-btn">Open</a><button class="ghost" @click="downloadMarketingDeliverable(item, 'pdf')">PDF</button><button class="ghost" @click="launchDeliverableToChat(item)">Use In Mission</button><button class="ghost" @click="sendMarketingDeliverable(item)">Send To Client</button></div></div></div>
          <p v-else class="muted">No marketing deliverables generated yet.</p>
        </div>
      </section>

      <section v-else-if="activeView === 'usage'" class="grid-two">
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">KPIs</span><h3>Usage summary tiles</h3></div></div>
          <div class="card-grid">
            <div class="mini-card"><label>Period calls</label><strong>{{ globalUsageSummary.totals.calls || 0 }}</strong><p class="muted">{{ usagePeriod.toUpperCase() }}</p></div>
            <div class="mini-card"><label>Free calls</label><strong>{{ globalUsageSummary.totals.freeCalls || 0 }}</strong><p class="muted">estimated free</p></div>
            <div class="mini-card"><label>Paid calls</label><strong>{{ globalUsageSummary.totals.paidCalls || 0 }}</strong><p class="muted">estimated paid</p></div>
            <div class="mini-card"><label>Paid cost</label><strong>{{ dualCurrency(globalUsageSummary.totals.estimatedCostUsd || 0) }}</strong><p class="muted">estimated cost</p></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Usage</span><h3>Global provider and model usage</h3></div></div>
          <div class="action-row"><select v-model="usagePeriod"><option value="all">All time</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select><button class="ghost" @click="refreshUsagePanels">Refresh Usage</button><button class="ghost" @click="downloadUsageReport('global', 'csv')">Export CSV</button><button class="ghost" @click="downloadUsageReport('global', 'pdf')">Export PDF</button></div>
          <div class="stack-list">
            <div class="stack-item">
              <strong>Global totals</strong>
              <p class="muted">{{ globalUsageSummary.totals.calls || 0 }} total calls · {{ globalUsageSummary.totals.freeCalls || 0 }} free · {{ globalUsageSummary.totals.paidCalls || 0 }} paid</p>
              <p class="muted">{{ dualCurrency(globalUsageSummary.totals.estimatedCostUsd || 0) }} estimated paid usage</p>
            </div>
            <div v-if="globalUsageSummary.providers?.length" class="stack-item">
              <strong>Provider breakdown</strong>
              <p v-for="provider in globalUsageSummary.providers" :key="provider.provider" class="muted">{{ provider.provider }} · {{ provider.calls }} calls · {{ provider.freeCalls }} free · {{ provider.paidCalls }} paid · {{ dualCurrency(provider.estimatedCostUsd || 0) }} · {{ provider.resetCadence }} · {{ Object.keys(provider.kinds || {}).join(' + ') || 'llm' }}</p>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Trend</span><h3>Daily usage trend</h3></div></div>
          <div v-if="globalUsageChart.length" class="usage-chart">
            <div v-for="point in globalUsageChart" :key="point.date" class="usage-bar-wrap">
              <div class="usage-bar" :style="{ height: point.height }" :title="`${point.date}: ${point.calls} calls`"></div>
              <span>{{ point.date.slice(5) }}</span>
            </div>
          </div>
          <p v-else class="muted">Trend data will appear after usage events are recorded.</p>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Share</span><h3>Provider share</h3></div></div>
          <div v-if="providerShareRows.length" class="stack-list"><div v-for="provider in providerShareRows" :key="provider.provider" class="stack-item"><div class="run-head"><strong>{{ provider.provider }}</strong><span>{{ provider.percentage }}%</span></div><p class="muted">{{ provider.calls }} calls · {{ dualCurrency(provider.estimatedCostUsd || 0) }}</p></div></div>
          <p v-else class="muted">Provider share will appear after tracked usage accumulates.</p>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Usage</span><h3>Client usage breakdown</h3></div><div class="context-box"><label>Client</label><select v-model="selectedFinanceClient"><option value="">Select Client</option><option v-for="client in clients" :key="client.id" :value="client.id">{{ client.name }}</option></select></div></div>
          <div class="action-row"><button class="ghost" @click="refreshUsagePanels">Refresh Usage</button><button class="ghost" :disabled="!selectedFinanceClient" @click="downloadUsageReport('client', 'csv')">Export CSV</button><button class="ghost" :disabled="!selectedFinanceClient" @click="downloadUsageReport('client', 'pdf')">Export PDF</button></div>
          <div class="stack-list">
            <div class="stack-item">
              <strong>Client totals</strong>
              <p class="muted">{{ clientUsageSummary.totals.calls || 0 }} total calls · {{ clientUsageSummary.totals.freeCalls || 0 }} free · {{ clientUsageSummary.totals.paidCalls || 0 }} paid</p>
              <p class="muted">{{ dualCurrency(clientUsageSummary.totals.estimatedCostUsd || 0) }} estimated paid usage</p>
            </div>
            <div v-if="clientUsageSummary.providers?.length" class="stack-item">
              <strong>Providers</strong>
              <p v-for="provider in clientUsageSummary.providers" :key="provider.provider" class="muted">{{ provider.provider }} · {{ provider.calls }} calls · {{ provider.freeCalls }} free · {{ provider.paidCalls }} paid · {{ dualCurrency(provider.estimatedCostUsd || 0) }} · {{ provider.resetCadence }} · {{ Object.keys(provider.kinds || {}).join(' + ') || 'llm' }}</p>
            </div>
            <div v-if="clientUsageSummary.models?.length" class="stack-item">
              <strong>Models</strong>
              <p v-for="model in clientUsageSummary.models" :key="`${model.provider}-${model.model}`" class="muted">{{ model.provider }} / {{ model.model }} · {{ model.calls }} calls · {{ model.freeCalls }} free · {{ model.paidCalls }} paid · {{ model.resetCadence }} · {{ model.kind || 'llm' }}</p>
            </div>
          </div>
          <p v-if="!selectedFinanceClient" class="muted">Select a client to see client-based model and media usage.</p>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Models</span><h3>Global model breakdown</h3></div></div>
          <div v-if="globalUsageSummary.models?.length" class="stack-list"><div v-for="model in globalUsageSummary.models" :key="`${model.provider}-${model.model}`" class="stack-item"><div class="run-head"><strong>{{ model.provider }}</strong><span>{{ model.kind || 'llm' }}</span></div><p class="muted">{{ model.model }}</p><p class="muted">{{ model.calls }} calls · {{ model.freeCalls }} free · {{ model.paidCalls }} paid · {{ dualCurrency(model.estimatedCostUsd || 0) }}</p><p class="muted">{{ model.resetCadence }}</p></div></div>
          <p v-else class="muted">No model usage recorded yet.</p>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Fallbacks</span><h3>Provider switch history</h3></div></div>
          <div v-if="recentProviderSwitches.length" class="stack-list"><div v-for="item in recentProviderSwitches" :key="`${item.runId}-${item.at}`" class="stack-item"><div class="run-head"><strong>{{ item.from }} -> {{ item.to }}</strong><span>{{ prettyDate(item.at) }}</span></div><p class="muted">{{ item.model || 'no model noted' }}</p><p class="muted">{{ item.requestPreview }}</p></div></div>
          <p v-else class="muted">Fallback switch events will appear here when Nexus rolls from one provider to another.</p>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Clients</span><h3>Top clients by usage</h3></div></div>
          <div v-if="usageLeaders.length" class="stack-list"><div v-for="leader in usageLeaders" :key="leader.clientId" class="stack-item"><div class="run-head"><strong>{{ leader.clientName }}</strong><span>{{ leader.calls }} calls</span></div><p class="muted">{{ leader.freeCalls }} free · {{ leader.paidCalls }} paid · {{ dualCurrency(leader.estimatedCostUsd || 0) }}</p></div></div>
          <p v-else class="muted">Client usage rankings will appear after tracked activity accumulates.</p>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Expensive</span><h3>Highest cost drivers</h3></div></div>
          <div class="stack-list">
            <div class="stack-item" v-if="mostExpensiveClient">
              <strong>Most expensive client</strong>
              <p class="muted">{{ mostExpensiveClient.clientName }}</p>
              <p class="muted">{{ dualCurrency(mostExpensiveClient.estimatedCostUsd || 0) }} · {{ mostExpensiveClient.calls }} calls</p>
            </div>
            <div class="stack-item" v-if="mostExpensiveModel">
              <strong>Most expensive model</strong>
              <p class="muted">{{ mostExpensiveModel.provider }} / {{ mostExpensiveModel.model }}</p>
              <p class="muted">{{ dualCurrency(mostExpensiveModel.estimatedCostUsd || 0) }} · {{ mostExpensiveModel.calls }} calls</p>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Guidance</span><h3>Free tier interpretation</h3></div></div>
          <div class="stack-list">
            <div class="stack-item"><strong>Estimated free vs paid</strong><p class="muted">These numbers are inferred from provider, model, and quota mode. They are not yet direct billing sync from Gemini, OpenRouter, Groq, NVIDIA, or media providers.</p></div>
            <div class="stack-item"><strong>Reset cadence</strong><p class="muted">Nexus shows a practical reset hint like daily free window, provider quota window, or paid usage. Exact resets still depend on each provider console and account plan.</p></div>
          </div>
        </div>
      </section>

      <section v-else-if="activeView === 'setup'" class="grid-two">
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Setup Center</span><h3>Provider onboarding and resume</h3></div></div>
          <div class="stack-list">
            <div class="stack-item">
              <strong>Guided onboarding</strong>
              <p class="muted">Launch provider setup missions directly from Nexus. If login, OTP, MFA, or account selection is needed, answer in chat and Nexus should continue the same setup flow.</p>
            </div>
            <div v-for="(info, key) in CLIENT_KEY_INFO" :key="`setup-${key}`" class="stack-item">
              <div class="run-head"><strong>{{ info.label }}</strong><span class="badge">{{ key }}</span></div>
              <p class="muted">{{ info.howTo }}</p>
              <div class="action-row">
                <button class="primary subtle" @click="openKeySetupWithNexus(key)">Start Setup</button>
                <button class="ghost" @click="activeView = 'settings'">Open Settings</button>
              </div>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><span class="tiny-label">Alerts</span><h3>Notification and continuation rules</h3></div></div>
          <div class="stack-list">
            <div class="stack-item">
              <strong>Boss alerts</strong>
              <p class="muted">When enabled, Nexus sends local notifications for tool actions, results, approvals needed, errors, and mission completion.</p>
              <div class="action-row"><button class="ghost" @click="enableNotifications">{{ alertsEnabled ? 'Alerts Enabled' : 'Enable Alerts' }}</button></div>
            </div>
            <div class="stack-item">
              <strong>Resume behavior</strong>
              <p class="muted">Setup flows should stay inside the same mission. If Nexus needs your input in the middle, reply in chat and it should resume instead of breaking the workflow.</p>
            </div>
          </div>
        </div>
      </section>

      <section v-else-if="activeView === 'tools'" class="panel">
        <div class="panel-head"><div><span class="tiny-label">Capabilities</span><h3>Provider readiness matrix</h3></div><button class="ghost" @click="loadToolsDashboard">Refresh</button></div>
        <div class="card-grid"><div v-for="tool in toolsData" :key="tool.id" class="mini-card"><div class="run-head"><strong>{{ tool.name }}</strong><span class="badge" :class="tool.status === 'active' ? 'success' : 'warning'">{{ tool.status }}</span></div><p class="muted">{{ tool.description }}</p><p class="muted" v-if="tool.diagnostics?.missingKeys?.length">Missing: {{ tool.diagnostics.missingKeys.join(', ') }}</p><p class="muted" v-else-if="tool.diagnostics?.ready">Ready: {{ (tool.diagnostics.configuredKeys || []).join(', ') || 'configured' }}</p><div class="action-row"><button class="ghost" @click="editTool(tool)">Configure</button><button class="primary subtle" @click="testTool(tool)">Test</button></div></div></div>
      </section>

      <section v-else class="panel">
        <div class="panel-head"><div><span class="tiny-label">Configuration</span><h3>Keys and quota controls</h3></div></div>
        <div class="stack-list">
          <div class="stack-item">
            <strong>Boss / Global default mode</strong>
            <p class="muted">Primary Gemini first, then OpenRouter, Groq, and NVIDIA fallback when configured.</p>
          </div>
          <div class="action-row"><select v-model="usagePeriod"><option value="all">All time</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select><button class="ghost" @click="refreshUsagePanels">Refresh Usage</button><button class="ghost" @click="downloadUsageReport('global', 'csv')">Export CSV</button><button class="ghost" @click="downloadUsageReport('global', 'pdf')">Export PDF</button></div>
          <div class="stack-item">
            <strong>Global model usage</strong>
            <p class="muted">{{ globalUsageSummary.totals.calls || 0 }} total calls · {{ globalUsageSummary.totals.freeCalls || 0 }} free · {{ globalUsageSummary.totals.paidCalls || 0 }} paid</p>
            <p class="muted">{{ dualCurrency(globalUsageSummary.totals.estimatedCostUsd || 0) }} estimated paid usage</p>
          </div>
          <div v-if="globalUsageSummary.providers?.length" class="stack-item">
            <strong>Provider breakdown</strong>
            <p v-for="provider in globalUsageSummary.providers.slice(0, 8)" :key="provider.provider" class="muted">{{ provider.provider }} · {{ provider.calls }} calls · {{ provider.freeCalls }} free · {{ provider.paidCalls }} paid · {{ dualCurrency(provider.estimatedCostUsd || 0) }} · {{ provider.resetCadence }} · {{ Object.keys(provider.kinds || {}).join(' + ') || 'llm' }}</p>
          </div>
          <div v-if="globalUsageSummary.models?.length" class="stack-item">
            <strong>Model breakdown</strong>
            <p v-for="model in globalUsageSummary.models.slice(0, 10)" :key="`${model.provider}-${model.model}`" class="muted">{{ model.provider }} / {{ model.model }} · {{ model.calls }} calls · {{ model.freeCalls }} free · {{ model.paidCalls }} paid · {{ model.resetCadence }} · {{ model.kind || 'llm' }}</p>
          </div>
        </div>
        <div v-for="group in configGroups" :key="group.title" class="settings-group">
          <div class="panel-head compact-head"><div><span class="tiny-label">Configuration group</span><h3>{{ group.title }}</h3></div></div>
          <div class="card-grid">
            <div v-for="entry in group.entries" :key="entry.key" class="mini-card">
              <label>{{ entry.label }}</label>
              <select v-if="entry.key === 'QUOTA_MODE'" v-model="configEdits[entry.key]">
                <option value="FREE">FREE</option>
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
              </select>
              <div v-else class="inline-input">
                <input :type="revealKeys[entry.key] ? 'text' : 'password'" v-model="configEdits[entry.key]" :placeholder="entry.isSet ? 'Configured' : 'Unset'">
                <button class="ghost" @click="revealKeys[entry.key] = !revealKeys[entry.key]">{{ revealKeys[entry.key] ? 'Hide' : 'Show' }}</button>
              </div>
            </div>
          </div>
        </div>
        <div class="action-row"><button class="primary" @click="saveConfig">Save Settings</button></div>
      </section>
    </main>

    <transition name="fade"><div v-if="isAddingClient" class="modal-backdrop" @click.self="isAddingClient = false"><div class="modal-card"><div class="panel-head"><div><span class="tiny-label">New client</span><h3>Create isolated operating context</h3></div><button class="ghost" @click="isAddingClient = false">Close</button></div><div class="card-grid"><div class="mini-card"><label>Name</label><input v-model="newClient.name" placeholder="Acme Growth"></div><div class="mini-card"><label>Company</label><input v-model="newClient.company" placeholder="Acme Pvt Ltd"></div><div class="mini-card"><label>Email</label><input v-model="newClient.email" placeholder="team@acme.com"></div><div class="mini-card"><label>Phone</label><input v-model="newClient.phone" placeholder="+91..."></div><div class="mini-card full"><label>Notes</label><textarea v-model="newClient.notes" placeholder="Brand, goals, constraints, operating notes."></textarea></div><div v-for="(info, key) in CLIENT_KEY_INFO" :key="key" class="mini-card"><div class="run-head"><label>{{ info.label }}</label><button class="link-btn" @click="clientKeyEditing = clientKeyEditing === key ? '' : key">How to get</button></div><p v-if="clientKeyEditing === key" class="muted">{{ info.howTo }}</p><div class="action-row compact-row"><button class="ghost" @click="openKeySetupWithNexus(key)">Set up with Nexus</button></div><input type="password" v-model="newClient.initialKeys[key]" :placeholder="info.placeholder"></div></div><div class="action-row"><button class="ghost" @click="isAddingClient = false">Cancel</button><button class="primary" @click="saveClient">Create Client</button></div></div></div></transition>
    <transition name="fade"><div v-if="isManagingClientKeys && activeClient" class="modal-backdrop" @click.self="isManagingClientKeys = false"><div class="modal-card"><div class="panel-head"><div><span class="tiny-label">Key management</span><h3>{{ activeClient.name }}</h3></div><button class="ghost" @click="isManagingClientKeys = false">Close</button></div><div class="stack-list"><div class="stack-item"><strong>LLM fallback keys appear first</strong><p class="muted">Gemini primary/backup, then OpenRouter, Groq, and NVIDIA client-specific overrides.</p></div></div><div class="card-grid"><div v-for="keyRow in clientKeysList" :key="keyRow.key" class="mini-card"><label>{{ keyRow.label || clientKeyLabels[keyRow.key] || keyRow.key }}</label><p v-if="CLIENT_KEY_INFO[keyRow.key]?.howTo" class="muted">{{ CLIENT_KEY_INFO[keyRow.key].howTo }}</p><div v-if="CLIENT_KEY_INFO[keyRow.key]?.setupPrompt" class="action-row compact-row"><button class="ghost" @click="openKeySetupWithNexus(keyRow.key)">Set up with Nexus</button></div><input type="password" v-model="clientKeyEdits[keyRow.key]" :placeholder="keyRow.isSet ? 'Configured' : 'Unset'"></div></div><div class="action-row"><button class="primary" @click="saveClientKeys">Save Keys</button></div></div></div></transition>
    <transition name="fade"><div v-if="isEditingTool && activeTool" class="modal-backdrop" @click.self="isEditingTool = false"><div class="modal-card"><div class="panel-head"><div><span class="tiny-label">Capability tuning</span><h3>{{ activeTool.name }}</h3></div><button class="ghost" @click="isEditingTool = false">Close</button></div><div class="mini-card"><p class="muted">{{ activeTool.description }}</p><span class="badge" :class="activeTool.status === 'active' ? 'success' : 'warning'">{{ activeTool.status === 'active' ? 'Operational' : 'Needs credentials' }}</span></div><div class="mini-card"><label>Operational rules</label><textarea v-model="configEdits[`TOOL_${activeTool.id.toUpperCase()}_RULES`]" placeholder="Example: Always return JSON with a short summary and risk flags."></textarea></div><div class="action-row"><button class="ghost" @click="testTool(activeTool)">Run Test</button><button class="primary" @click="updateToolConfig">Save Guidance</button></div></div></div></transition>
    <div v-if="configToast.show" class="toast" :class="configToast.type">{{ configToast.message }}</div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Manrope:wght@400;500;700;800&display=swap');

:root {
  --bg: #f4efe6;
  --bg-overlay-1: rgba(204, 92, 45, 0.17);
  --bg-overlay-2: rgba(47, 90, 75, 0.16);
  --surface: rgba(255, 252, 247, 0.84);
  --surface-strong: rgba(255, 248, 239, 0.96);
  --sidebar: rgba(248, 241, 232, 0.78);
  --ink: #1f1d1a;
  --muted: #6e655b;
  --line: rgba(74, 53, 35, 0.14);
  --accent: #cc5c2d;
  --accent-2: #aa4624;
  --brand-glow: rgba(161, 61, 38, 0.28);
  --olive: #2f5a4b;
  --warn: #b56a17;
  --danger: #b53d2b;
  --user-chat-start: #2f5a4b;
  --user-chat-end: #1e4236;
  --chat-user-ink: #f6f4f0;
  --hero-start: rgba(255, 247, 240, 0.98);
  --hero-end: rgba(244, 232, 219, 0.9);
  --ghost-bg: rgba(255, 250, 244, 0.72);
  --input-bg: rgba(255, 251, 246, 0.88);
  --stack-bg: rgba(255, 251, 246, 0.78);
  --shadow: 0 30px 70px rgba(58, 35, 19, 0.14);
  --shell-start: rgba(251, 246, 239, 0.98);
  --shell-end: rgba(240, 231, 220, 0.96);
  --sidebar-grad-end: rgba(235, 225, 213, 0.96);
}

:root[data-theme='dark'] {
  --bg: #0b0716;
  --bg-overlay-1: rgba(82, 40, 151, 0.38);
  --bg-overlay-2: rgba(15, 11, 36, 0.92);
  --surface: rgba(18, 14, 36, 0.82);
  --surface-strong: rgba(20, 16, 40, 0.94);
  --sidebar: rgba(10, 8, 24, 0.86);
  --ink: #f5f2ff;
  --muted: #a59bc8;
  --line: rgba(131, 108, 200, 0.18);
  --accent: #8a63ff;
  --accent-2: #5d39d6;
  --brand-glow: rgba(93, 57, 214, 0.34);
  --olive: #74d3bc;
  --warn: #f4b860;
  --danger: #ff7d94;
  --user-chat-start: #2b1e63;
  --user-chat-end: #1b123f;
  --chat-user-ink: #f4efff;
  --hero-start: rgba(24, 18, 49, 0.98);
  --hero-end: rgba(12, 10, 28, 0.94);
  --ghost-bg: rgba(20, 16, 40, 0.72);
  --input-bg: rgba(16, 13, 33, 0.9);
  --stack-bg: rgba(17, 14, 34, 0.86);
  --shadow: 0 30px 90px rgba(3, 1, 12, 0.52);
  --shell-start: rgba(10, 8, 22, 0.98);
  --shell-end: rgba(18, 13, 37, 0.98);
  --sidebar-grad-end: rgba(11, 9, 27, 0.96);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: 'Manrope', sans-serif;
  color: var(--ink);
  background:
    radial-gradient(circle at 22% 8%, var(--bg-overlay-1), transparent 30%),
    radial-gradient(circle at 78% 92%, var(--bg-overlay-2), transparent 36%),
    linear-gradient(180deg, var(--bg) 0%, color-mix(in srgb, var(--bg) 90%, #000 10%) 100%);
  overflow: hidden;
}

button, input, textarea, select { font: inherit; }

.app-shell {
  min-height: 100vh;
  height: 100vh;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  background:
    radial-gradient(circle at 18% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 28%),
    radial-gradient(circle at 86% 100%, color-mix(in srgb, var(--accent-2) 20%, transparent), transparent 24%),
    linear-gradient(180deg, var(--shell-start) 0%, var(--shell-end) 100%);
  overflow: hidden;
  width: 100%;
}

.app-shell.compact {
  grid-template-columns: 104px minmax(0, 1fr);
}

.app-shell.railHidden .chat-layout {
  grid-template-columns: 1fr;
}

.sidebar {
  padding: 28px 20px;
  border-right: 1px solid var(--line);
  background: linear-gradient(180deg, color-mix(in srgb, var(--sidebar) 94%, transparent) 0%, var(--sidebar-grad-end) 100%);
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 0;
  height: 100vh;
}

.sidebar.collapsed .brand-sub,
.sidebar.collapsed .nav-sub,
.sidebar.collapsed .tiny-copy,
.sidebar.collapsed .brand-name,
.sidebar.collapsed .brand-logo-image {
  display: none;
}

.brand { display: flex; align-items: center; gap: 14px; }

.brand-mark {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-2) 55%, #24123f);
  box-shadow: 0 20px 35px var(--brand-glow);
  overflow: hidden;
}

.brand-copy { display: grid; gap: 6px; min-width: 0; }
.brand-logo-image {
  /* height: 24px; */
  width: auto;
  max-width: 150px;
  object-fit: contain;
  filter: brightness(1.05);
}
.brand-icon-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: left center;
  transform: scale(1.15);
}

.brand-name, .brand-sub, .eyebrow, .tiny-label, .nav-sub { margin: 0; }
.brand-name, .topbar h1, .hero-card h2, .panel h3 { font-family: 'Space Grotesk', sans-serif; }
.brand-name { font-size: .92rem; }

.sidebar-stack, .stack-list, .card-grid, .rail { display: grid; gap: 12px; }

.usage-chart {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(24px, 1fr));
  gap: 10px;
  align-items: end;
  min-height: 190px;
}

.usage-bar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: end;
  gap: 8px;
  min-height: 190px;
}

.usage-bar {
  width: 100%;
  min-height: 10px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--accent), var(--accent-2));
  box-shadow: 0 10px 24px rgba(138, 99, 255, 0.24);
}

.usage-bar-wrap span {
  font-size: 0.66rem;
  color: var(--muted);
}

.sidebar-card, .nav-item, .panel, .hero-card, .metric-card, .mini-card, .modal-card, .message-card, .composer, .toast {
  border: 1px solid var(--line);
  background: var(--surface);
  backdrop-filter: blur(14px);
  box-shadow: var(--shadow);
  border-radius: 24px;
}

.sidebar-card, .panel, .hero-card, .metric-card, .modal-card { padding: 20px; }

.nav-item {
  text-align: left;
  padding: 12px 14px;
  cursor: pointer;
  transition: .18s;
  color: var(--ink);
  min-height: 62px;
}

.nav-item.active, .nav-item:hover, .stack-item:hover, .primary:hover, .ghost:hover, .danger:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 34%, transparent);
  background: color-mix(in srgb, var(--surface) 82%, var(--accent) 18%);
}

.nav-title { display: block; font-weight: 700; }
.nav-sub, .tiny-copy, .muted, .message-text p { color: var(--muted); }
.tiny-label, .eyebrow { text-transform: uppercase; letter-spacing: .08em; font-size: .68rem; font-weight: 800; }

.workspace {
  padding: 0;
  display: grid;
  gap: 18px;
  min-height: 100vh;
  overflow: auto;
  position: relative;
  width: 100%;
  min-width: 0;
  margin: 0;
}

.workspace.chat-mode {
  height: 100vh;
  overflow: hidden;
}
.topbar, .action-row, .panel-head, .run-head, .inline-input { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.topbar {
  position: sticky;
  top: 0;
  z-index: 6;
  padding: 6px 10px 10px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg) 92%, transparent) 0%, color-mix(in srgb, var(--bg) 70%, transparent) 75%, transparent 100%);
  backdrop-filter: blur(18px);
}
.topbar h1 { margin: 0; font-size: clamp(1.28rem, 1.5vw, 1.7rem); line-height: 1.05; }

.hero-grid {
  display: grid;
  grid-template-columns: minmax(320px, 1.6fr) repeat(3, minmax(120px, .44fr));
  gap: 12px;
  align-items: stretch;
}

.hero-grid.compact-bar {
  grid-auto-rows: minmax(110px, auto);
}

.hero-grid.expanded,
.hero-grid.docked {
  grid-template-columns: minmax(320px, 1.6fr) repeat(3, minmax(120px, .44fr));
}

.hero-card {
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 18%, transparent), transparent 28%),
    linear-gradient(135deg, var(--hero-start), var(--hero-end));
  padding: 16px 18px;
}
.hero-card h2 { font-size: clamp(1.05rem, 1.25vw, 1.55rem); margin: 6px 0 4px; line-height: 1.08; }

.pill-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.pill {
  padding: 7px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
  font-size: .8rem;
  font-weight: 700;
}
.selector-pill {
  cursor: pointer;
  transition: .18s;
}
.selector-pill.active {
  background: color-mix(in srgb, var(--accent) 18%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 44%, transparent);
  color: var(--ink);
}

.metric-card {
  padding: 14px 16px;
  min-height: 110px;
}

.metric-card strong {
  display: block;
  margin: 8px 0 2px;
  font-size: 1.55rem;
  font-family: 'Space Grotesk', sans-serif;
}
.chat-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  min-height: 0;
  height: calc(100vh - 128px);
  align-items: stretch;
  overflow: hidden;
}
.panel-chat {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 88%, transparent) 0%, color-mix(in srgb, var(--surface) 94%, transparent) 100%);
}
.stage-strip {
  display:grid;
  grid-template-columns: 150px minmax(0,1fr) 150px;
  gap:10px;
  flex: 0 0 auto;
  width: 75%;
}
.stage-card {
  border:1px solid var(--line);
  background: linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 90%, transparent) 0%, color-mix(in srgb, var(--stack-bg) 94%, transparent) 100%);
  border-radius:18px;
  padding:12px 14px;
  display:grid;
  gap:4px;
}
.stage-card strong { font-size: .84rem; }
.stage-detail strong { font-size: .8rem; line-height: 1.35; }
.context-box { display: grid; gap: 6px; }

.chat-stream {
  flex: 1 1 auto;
  min-height: 220px;
  max-height: 52vh;
  overflow: auto;
  display: grid;
  gap: 14px;
  padding-right: 6px;
  padding-bottom: 8px;
  align-content: start;
}

.message-row.user { display: flex; justify-content: flex-end; }

.message-card { max-width: min(78%, 720px); padding: 12px 14px; }
.message-card.user { background: linear-gradient(135deg, var(--user-chat-start), var(--user-chat-end)); color: var(--chat-user-ink); }
.message-card.nexus_result, .message-card.nexus { background: var(--surface); }
.message-card.nexus_thought { background: color-mix(in srgb, var(--accent) 10%, var(--surface) 90%); border-style: dashed; }
.message-card.nexus_error { background: color-mix(in srgb, var(--danger) 10%, var(--surface) 90%); border-color: color-mix(in srgb, var(--danger) 25%, transparent); }
.message-text { line-height: 1.48; margin-top: 6px; word-break: break-word; font-size: .92rem; }

.composer {
  padding: 14px;
  display: grid;
  gap: 10px;
  flex: 0 0 auto;
  background: color-mix(in srgb, var(--surface-strong) 94%, transparent);
  box-shadow: 0 -16px 34px rgba(6, 4, 14, 0.35);
}
.composer textarea, .mini-card textarea, .mini-card input, .mini-card select, .context-box select, .inline-input input {
  width: 100%;
  border: 1px solid var(--line);
  background: var(--input-bg);
  border-radius: 18px;
  padding: 12px 14px;
  color: var(--ink);
}

.composer textarea, .mini-card textarea { min-height: 92px; resize: vertical; }
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: -2px;
}
.chip-button {
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface-strong) 88%, transparent);
  color: var(--ink);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: .84rem;
  line-height: 1;
}
.chip-button:hover {
  border-color: color-mix(in srgb, var(--accent) 38%, var(--line));
  background: color-mix(in srgb, var(--accent) 14%, var(--surface-strong) 86%);
}
.engine-card {
  position: relative;
  overflow: hidden;
  
    display: flex !important;
    justify-content: space-between;

}
.engine-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--engine-accent, var(--accent));
  border-radius: 999px;
}
.engine-gemini {
  --engine-accent: #5f8cff;
}
.engine-openrouter {
  --engine-accent: #ff8d57;
}
.engine-groq {
  --engine-accent: #3fd3a4;
}
.engine-nvidia {
  --engine-accent: #9be15d;
}
.engine-card .badge.success {
  background: color-mix(in srgb, var(--engine-accent) 20%, transparent);
  border-color: color-mix(in srgb, var(--engine-accent) 36%, transparent);
  color: color-mix(in srgb, var(--engine-accent) 75%, white 25%);
}
.plan-ready-card {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--line));
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
}
.settings-group {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}
.compact-row {
  justify-content: flex-start;
  margin-top: -4px;
}
.compact-head {
  padding-inline: 2px;
}
.grid-two { display: grid; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: 18px; }
.card-grid { grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
.mini-card { padding: 18px; display: grid; gap: 12px; }
.mini-card.full { grid-column: 1 / -1; }

.stack-item {
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: var(--stack-bg);
  text-decoration: none;
  color: inherit;
}

.rail {
  min-height: 0;
  height: 100%;
  overflow: auto;
  overflow-x: hidden;
  max-width: 320px;
  padding-right: 4px;
  display: grid;
  gap: 12px;
  align-content: start;
}

.topbar-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.compact-metric {
  min-height: 110px;
  padding: 14px 16px;
}

.compact-metric strong {
  margin-top: 8px;
  font-size: 1.5rem;
}

.compact-metric p,
.hero-card .muted {
  margin: 0;
  font-size: .84rem;
  line-height: 1.4;
}

.app-shell.compact .workspace {
  width: 100%;
}

.app-shell.compact .sidebar {
  width: 104px;
  padding-inline: 14px;
}

.app-shell.compact .brand {
  justify-content: center;
}

.app-shell.compact .nav-item,
.app-shell.compact .sidebar-card {
  padding-inline: 12px;
}

.app-shell.railHidden .hero-grid {
  grid-template-columns: minmax(320px, 1.8fr) repeat(3, minmax(120px, .36fr));
}

.app-shell.railHidden .hero-grid.compact-bar {
  grid-template-columns: minmax(320px, 1.8fr) repeat(3, minmax(120px, .36fr));
}

.app-shell.railHidden .chat-layout {
  grid-template-columns: 1fr;
}

.summary-scroll {
  display: grid;
  gap: 10px;
  max-height: none;
  overflow: visible;
}

.summary-hero {
  padding: 14px 16px;
}

.summary-metrics {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.panel,
.metric-card,
.mini-card,
.sidebar-card {
  background: linear-gradient(180deg, rgba(22, 17, 42, 0.92) 0%, rgba(16, 13, 31, 0.9) 100%);
}

.approval-json {
  margin: 0;
  padding: 14px;
  border-radius: 16px;
  background: rgba(9, 8, 18, 0.68);
  border: 1px solid rgba(131, 108, 200, 0.14);
  overflow: auto;
  color: var(--muted);
}

.chat-stream::-webkit-scrollbar,
.rail::-webkit-scrollbar {
  width: 10px;
}

.chat-stream::-webkit-scrollbar-thumb,
.rail::-webkit-scrollbar-thumb {
  background: rgba(138, 99, 255, 0.22);
  border-radius: 999px;
}

.badge {
  padding: 7px 10px;
  border-radius: 999px;
  font-size: .78rem;
  font-weight: 800;
  text-transform: capitalize;
  background: color-mix(in srgb, var(--muted) 18%, transparent);
}

.badge.success, .badge.completed { background: color-mix(in srgb, var(--olive) 20%, transparent); color: var(--olive); }
.badge.warning, .badge.paused, .badge.retry_wait { background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--warn); }
.badge.running, .badge.queued { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); }
.badge.stopped, .badge.error, .badge.failed, .badge.dead_letter, .badge.cancelled { background: color-mix(in srgb, var(--danger) 18%, transparent); color: var(--danger); }

button { border: none; cursor: pointer; }

.primary, .ghost, .danger, .link-btn {
  padding: 10px 14px;
  border-radius: 999px;
  transition: .18s;
}

.primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff7f0;
}

.primary.subtle { background: linear-gradient(135deg, var(--olive), color-mix(in srgb, var(--olive) 70%, #10231d 30%)); }
.ghost { background: var(--ghost-bg); border: 1px solid var(--line); color: var(--ink); }
.danger { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
.link-btn { background: transparent; color: var(--accent); padding: 0; }

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(12, 8, 24, 0.42);
  backdrop-filter: blur(10px);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 20;
}

.modal-card { width: min(980px, 100%); max-height: 90vh; overflow: auto; background: var(--surface-strong); }
.toast { position: fixed; right: 22px; bottom: 22px; padding: 14px 18px; z-index: 30; }
.hidden-input { display: none; }
.mobile-only { display: none; }
.mobile-secondary { display: inline-flex; }
.desktop-only { display: inline-flex; }
.fade-enter-active, .fade-leave-active { transition: opacity .16s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width:1100px) {
  body {
    overflow: auto;
  }
  .app-shell {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }
  .app-shell, .hero-grid, .chat-layout, .grid-two { grid-template-columns: 1fr; }
  .workspace {
    height: auto;
    overflow: visible;
    width: 100%;
  }
  .panel-chat, .rail {
    height: auto;
    max-height: none;
  }
  .panel-chat {
    display: block;
    min-height: auto;
    overflow: visible;
    padding: 18px;
  }
  .panel-chat > * + * {
    margin-top: 12px;
  }
  .panel-chat .panel-head {
    display: grid;
    gap: 12px;
  }
  .panel-chat .context-box,
  .panel-chat .context-box select {
    width: 100%;
  }
  .chat-stream,
  .rail {
    min-height: unset;
    overflow: visible;
  }
  .chat-stream {
    min-height: 180px;
    max-height: 38vh;
    overflow: auto;
  }
  .rail {
    display: none;
  }
  .stage-strip {
    display: none;
  }
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: min(320px, 86vw);
    transform: translateX(-105%);
    transition: transform .18s;
    z-index: 25;
  }
  .sidebar.open { transform: translateX(0); }
  .mobile-only { display: inline-flex; }
  .topbar {
    position: static;
    padding-top: 0;
  }
  .chat-layout {
    height: auto;
    overflow: visible;
    display: block;
  }
  .hero-grid.compact-bar,
  .app-shell.railHidden .hero-grid.compact-bar {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
  }
}

@media (max-width:720px) {
  .workspace { padding: 16px; }
  .chat-layout {
    display: block;
    height: auto;
    overflow: scroll;
  }
  .panel-chat {
    display: block;
    min-height: auto;
    height: auto;
    overflow: visible;
    padding: 18px;
  }
  .panel-chat > * + * {
    margin-top: 12px;
  }
  .panel-chat .panel-head {
    display: grid;
    gap: 12px;
  }
  .panel-chat .context-box {
    width: 100%;
  }
  .panel-chat .context-box select {
    width: 100%;
  }
  .stage-strip {
    display: none;
  }
  .chat-stream {
    min-height: 180px;
    max-height: 38vh;
    overflow: auto;
    padding-right: 2px;
  }
  .rail {
    display: none;
  }
  .message-card { max-width: 100%; }
  .topbar, .panel-head, .run-head, .inline-input { flex-direction: column; align-items: flex-start; }
  .action-row { align-items: center; }
  .stage-strip { grid-template-columns: 1fr; }
  .hero-card,
  .metric-card,
  .panel,
  .sidebar-card,
  .composer,
  .message-card {
    border-radius: 20px;
  }
  .brand {
    gap: 10px;
  }
  .brand-logo-image {
    max-width: 118px;
    height: 20px;
  }
  .topbar-actions {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .topbar-actions > * {
    width: 100%;
    min-width: 0;
    justify-content: center;
    padding-inline: 10px;
  }
  .desktop-only {
    display: none;
  }
  .mobile-secondary,
  .mobile-only {
    display: inline-flex;
  }
  .topbar .primary {
    grid-column: 1 / -1;
  }
  .composer {
    position: static;
    margin-top: 12px;
  }
  body {
    overflow: auto;
  }
  .app-shell {
    height: auto;
    overflow: visible;
  }
}
</style>
