<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { io } from 'socket.io-client'
import { useTheme } from 'vuetify'
import './styles/app-shell.css'
import { dualCurrency, formatMessage, isLikelyContinuationPrompt, prettyDate } from './composables/useFormatters'
import { useClientAdmin } from './composables/useClientAdmin'
import { useFinanceOperations } from './composables/useFinanceOperations'
import { useMarketingOperations } from './composables/useMarketingOperations'
import { useSetupAndUsage } from './composables/useSetupAndUsage'
import { useChatShellActions } from './composables/useChatShellActions'
import { useShellComputed } from './composables/useShellComputed'
import { useSocketSession } from './composables/useSocketSession'
import ChatMissionPanel from './components/ChatMissionPanel.vue'
import ClientsView from './components/ClientsView.vue'
import FinanceView from './components/FinanceView.vue'
import MarketingView from './components/MarketingView.vue'
import SettingsView from './components/SettingsView.vue'
import SetupCenterView from './components/SetupCenterView.vue'
import ToolsView from './components/ToolsView.vue'
import UsageDashboard from './components/UsageDashboard.vue'
import AddClientModal from './components/AddClientModal.vue'
import ClientKeysModal from './components/ClientKeysModal.vue'
import EditToolModal from './components/EditToolModal.vue'

const socket = io()
const vuetifyTheme = useTheme()
const activeView = ref('setup')
const chatHistory = ref([{ sender: 'nexus', text: 'Mission control is online, Boss. Give me the objective.' }])
const runtimeLogs = ref([])
const missionTrace = ref([])
const sessionId = ref(localStorage.getItem('nexus_session_id'))
const promptInput = ref('')
const isWorking = ref(false)
const missionStatus = ref('idle')
const selectedClientForChat = ref('')
const chatMissionPanel = ref(null)
const clients = ref([])
const toolsData = ref([])
const configEntries = ref([])
const configEdits = ref({})
const revealKeys = ref({})
const outputFiles = ref([])
const sessionCatalog = ref([])
const missionSummary = ref({ activeRun: null, recentRuns: [], totals: { missions: 0, successRate: 0, paused: 0, toolCalls: 0, llmCalls: 0, estimatedCostUsd: 0, totalTokens: 0 }, queue: { jobs: [], totals: { queued: 0, paused: 0, completed: 0 } }, usage: { sessionEstimatedCostUsd: 0, completedJobs: 0 } })
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
const globalUsageSummary = ref({ totals: { calls: 0, freeCalls: 0, paidCalls: 0, toolCalls: 0, llmCalls: 0, mediaCalls: 0, activeDays: 0, estimatedCostUsd: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 }, providers: [], models: [], tools: [], window: { firstUsedAt: null, lastUsedAt: null }, daily: [] })
const clientUsageSummary = ref({ totals: { calls: 0, freeCalls: 0, paidCalls: 0, toolCalls: 0, llmCalls: 0, mediaCalls: 0, activeDays: 0, estimatedCostUsd: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 }, providers: [], models: [], tools: [], window: { firstUsedAt: null, lastUsedAt: null }, daily: [] })
const usagePeriod = ref('all')
const usageLeaders = ref([])
const missionModeOverride = ref('chat')
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
  currency: 'INR',
  includeStrategyRetainer: true,
  notes: ''
})
const selectedAgencyServices = ref(['banner_design', 'copywriting', 'tag_research', 'meta_ads_management', 'strategy_retainer'])
const plannedAgencyQuote = ref(null)
const quoteDraft = ref({
  items: [{ serviceCode: 'banner_design', quantity: 1 }],
  profitMarginPct: 35,
  taxPct: 0,
  currency: 'INR',
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
const isMobileNavOpen = ref(false)
const isMobileRailOpen = ref(false)
const isSidebarCollapsed = ref(false)
const isRailCollapsed = ref(true)
const isMobileViewport = ref(false)
const isSummaryVisible = ref(true)
const theme = ref(localStorage.getItem('nexus_theme') || 'light')
const zoomLevel = ref(parseFloat(localStorage.getItem('nexus_zoom_level') || '1.0'))
const brandLogoUrl = 'https://jarvis-test-89c81.web.app/assets/nexusOS_logo.png'
const newClient = ref({ name: '', company: '', email: '', phone: '', notes: '', initialKeys: {} })
const configToast = ref({ show: false, message: '', type: 'success' })
const alertsEnabled = ref(localStorage.getItem('nexus_alerts_enabled') === 'true')
const selectedQuotePreset = ref('custom')
const setupDoctor = ref({ summary: { ready: true, status: 'ready', message: '' }, blockers: [], recommendations: [], providers: [] })
const setupPlaybooks = ref([])
const proactiveProposals = ref([])
const pnlReport = ref({ totalRevenue: 0, totalExpenses: 0, netProfit: 0, profitMargin: 0, expensesByProvider: {}, transactionCount: 0, recentTransactions: [] })
const pnlPeriod = ref('all')
const proactiveScanNiche = ref('')
const isVoiceListening = ref(false)
let voiceRecognition = null

function syncViewport() {
  if (typeof window === 'undefined') return
  isMobileViewport.value = window.innerWidth <= 1100
  if (!isMobileViewport.value) {
    isMobileNavOpen.value = false
    isMobileRailOpen.value = false
  }
}

function startVoiceInput() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('Voice recognition not supported in this browser. Try Chrome or Edge, Boss.', 'error'); return
  }

  try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    voiceRecognition = new SpeechRecognition()
    voiceRecognition.continuous = false
    voiceRecognition.interimResults = false
    // Use Indian English for better accuracy in target region, fallback to US
    voiceRecognition.lang = 'en-IN'

    voiceRecognition.onstart = () => {
      isVoiceListening.value = true
      showToast('I am listening, Boss...', 'success')
    }

    voiceRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      promptInput.value = (promptInput.value ? promptInput.value.trim() + ' ' : '') + transcript
      showToast('Voice captured: ' + transcript.slice(0, 40) + '...', 'success')
    }

    voiceRecognition.onerror = (event) => {
      isVoiceListening.value = false
      const errorMap = {
        'not-allowed': 'Microphone access denied, Boss.',
        'no-speech': 'No speech detected. Try again?',
        'network': 'Voice network error. Check connection.',
        'aborted': 'Listening cancelled.'
      }
      showToast(errorMap[event.error] || 'Voice error: ' + event.error, 'error')
    }

    voiceRecognition.onend = () => {
      isVoiceListening.value = false
    }

    voiceRecognition.start()
  } catch (err) {
    console.error('Voice start failed:', err)
    isVoiceListening.value = false
    showToast('Could not start microphone.', 'error')
  }
}

function stopVoiceInput() {
  try {
    if (voiceRecognition) voiceRecognition.stop()
  } catch (err) {
    console.warn('Voice stop error:', err)
  }
  isVoiceListening.value = false
}


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
  },
  multi_channel_social: {
    label: 'Multi-Channel Social',
    description: '4 weeks of promotion across Meta, Google, and X.',
    values: { campaignName: 'Multi-Channel Social', bannerCount: 2, carouselCount: 1, videoCount: 0, contentDeliverables: 4, tagPackages: 2, reportCount: 1, auditCount: 0, metaAdsWeeks: 4, googleAdsWeeks: 4, xAdsWeeks: 4, linkedinAdsWeeks: 0, websiteProject: false, websitePages: 1, adSpendMonthly: 0, includeStrategyRetainer: true }
  }
}

const navItems = [
  { view: 'setup', label: 'Setup Center', eyebrow: 'Step 1 - Provider onboarding', icon: 'SC' },
  { view: 'settings', label: 'Settings', eyebrow: 'Step 2 - Boss keys and defaults', icon: 'ST' },
  { view: 'tools', label: 'Capabilities', eyebrow: 'Step 3 - Provider readiness', icon: 'CP' },
  { view: 'clients', label: 'Clients', eyebrow: 'Step 4 - Add clients and keys', icon: 'CL' },
  { view: 'chat', label: 'Mission Control', eyebrow: 'Step 5 - Run client work', icon: 'MC' },
  { view: 'marketing', label: 'Marketing', eyebrow: 'Step 6 - Structured marketing workflows', icon: 'MK' },
  { view: 'finance', label: 'Finance', eyebrow: 'Step 7 - Quotes and invoices', icon: 'FN' },
  { view: 'usage', label: 'Usage', eyebrow: 'Step 8 - Costs and analytics', icon: 'US' }
]

const recommendedFlow = [
  { view: 'setup', title: 'Setup Nexus', note: 'Run Setup Doctor and connect providers.' },
  { view: 'settings', title: 'Add Boss Keys', note: 'Save internal company defaults and global keys.' },
  { view: 'tools', title: 'Check Capabilities', note: 'Confirm which tools are ready before client work.' },
  { view: 'clients', title: 'Add Client', note: 'Create the client, then attach client-specific keys if needed.' },
  { view: 'chat', title: 'Run Mission', note: 'Select context and ask Nexus to do the actual task.' },
  { view: 'marketing', title: 'Marketing Work', note: 'Use for audit bundles, briefs, and social workflows.' },
  { view: 'finance', title: 'Finance Work', note: 'Use for quotes, invoices, and commercial follow-up.' }
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
  { key: 'x_ads_management', label: 'X Promotion', fields: ['xAdsWeeks', 'adSpendMonthly'] },
  { key: 'linkedin_ads_management', label: 'LinkedIn Promotion', fields: ['linkedinAdsWeeks', 'adSpendMonthly'] },
  { key: 'website_development', label: 'Website Development', fields: ['websiteProject', 'websitePages'] },
  { key: 'strategy_retainer', label: 'Strategy Retainer', fields: ['includeStrategyRetainer'] }
]

const CLIENT_KEY_INFO = {
  GEMINI_API_KEY: { label: 'Gemini API Key 1', placeholder: 'AIza...', howTo: 'Create in Google AI Studio for primary inference.', setupPrompt: 'Open Google AI Studio, create a Gemini API key for primary inference, and wait for my input if any login or confirmation is needed.' },
  GEMINI_API_KEY_2: { label: 'Gemini API Key 2', placeholder: 'AIza...', howTo: 'Create a second key for failover rotation.', setupPrompt: 'Open Google AI Studio and help me create a backup Gemini API key for failover rotation. Pause for my login or MFA input when needed, then continue.' },
  BRAVE_SEARCH_API_KEY: { label: 'Brave Search API Key', placeholder: 'BSA...', howTo: 'Create in Brave Search API dashboard.', setupPrompt: 'Open Brave Search API dashboard and guide me step by step to create a Brave Search API key. Pause for any login or payment inputs and continue after I reply.' },
  TAVILY_API_KEY: { label: 'Tavily API Key', placeholder: 'tvly-...', howTo: 'Create in Tavily dashboard as a search fallback provider.', setupPrompt: 'Open Tavily and guide me step by step to create an API key for Nexus search fallback. Pause for login or verification input and continue after I reply.' },
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
  GMAIL_APP_PASSWORD: { label: 'Gmail App Password', placeholder: '16-char app password', howTo: 'Generate from Google Account security settings.', setupPrompt: 'Open Google Account security settings and guide me step by step to generate a Gmail app password for Nexus OS. Pause for login, 2FA, or confirmation input and continue after I reply.' },
  X_API_KEY: { label: 'X API Key', placeholder: '...', howTo: 'Create in X Developer Portal (v2).', setupPrompt: 'Open X Developer Portal and help me create a set of API keys for Nexus. Pause for login or project selection when needed.' },
  X_API_SECRET: { label: 'X API Secret', placeholder: '...', howTo: 'Copy from the API Keys tab in X portal.', setupPrompt: 'Help me retrieve and save the X API Secret safely.' },
  X_ACCESS_TOKEN: { label: 'X Access Token', placeholder: '...', howTo: 'Generate in the User Authentication Settings of your X App.', setupPrompt: 'Guide me to generate the X User Access Token with Post permissions.' },
  X_ACCESS_SECRET: { label: 'X Access Secret', placeholder: '...', howTo: 'Copy from the same screen as the Access Token.', setupPrompt: 'Help me save the X Access Secret.' }
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
  TAVILY_API_KEY: 'Tavily API Key (Search Fallback)',
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
  X_API_KEY: 'X API Key (Consumer Key)',
  X_API_SECRET: 'X API Secret (Consumer Secret)',
  X_ACCESS_TOKEN: 'X Access Token',
  X_ACCESS_SECRET: 'X Access Secret',
  QUOTA_MODE: 'Performance Mode (FREE, NORMAL, HIGH)'
}
const LLM_DEFAULT_VALUES = {
  OPENROUTER_MODEL: 'openrouter/free',
  GROQ_MODEL: 'llama-3.1-8b-instant',
  NVIDIA_MODEL: 'meta/llama-3.1-8b-instruct',
  QUOTA_MODE: 'FREE'
}

const {
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
} = useShellComputed({
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
  serviceSelectorOptions: SERVICE_SELECTOR_OPTIONS,
  globalUsageSummary,
  usageLeaders,
  runtimeLogs,
  activeMissionModeSource: 'execute',
  chatHistory,
  missionStatus,
  llmStatusSource: { provider: 'Gemini', model: 'gemini-2.5-flash' }
})
const configGroups = computed(() => {
  const groups = [
    {
      title: 'Boss / Global LLM Defaults',
      keys: ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'OPENROUTER_API_TOKEN', 'OPENROUTER_MODEL', 'GROQ_API_KEY', 'GROQ_MODEL', 'NVIDIA_NIM_API_KEY', 'NVIDIA_MODEL', 'QUOTA_MODE']
    },
    {
      title: 'Channels and Outreach',
      keys: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_PAGE_ID', 'WHATSAPP_PHONE_ID', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET', 'LINKEDIN_ACCESS_TOKEN']
    },
    {
      title: 'Search, Ads, Billing',
      keys: ['BRAVE_SEARCH_API_KEY', 'TAVILY_API_KEY', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_DEVELOPER_TOKEN', 'STRIPE_SECRET_KEY', 'APP_BASE_URL', 'REPLICATE_API_TOKEN']
    }
  ]
  return groups.map((group) => ({
    ...group,
    entries: group.keys.map((key) => configEntries.value.find((entry) => entry.key === key)).filter(Boolean)
  })).filter((group) => group.entries.length)
})
const priorityClientKeys = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'OPENROUTER_API_TOKEN', 'OPENROUTER_MODEL', 'GROQ_API_KEY', 'GROQ_MODEL', 'NVIDIA_NIM_API_KEY', 'NVIDIA_MODEL']
let syncTimeout = null

watch(theme, (value) => {
  document.documentElement.setAttribute('data-theme', value)
  localStorage.setItem('nexus_theme', value)
  vuetifyTheme.global.name.value = value === 'dark' ? 'darkTheme' : 'lightTheme'
}, { immediate: true })

watch(zoomLevel, (value) => {
  const scale = Math.max(0.7, Math.min(1.3, value))
  document.documentElement.style.setProperty('--nexus-zoom', scale.toString())
  localStorage.setItem('nexus_zoom_level', scale.toString())
}, { immediate: true })

function adjustZoom(delta) {
  zoomLevel.value = Math.max(0.7, Math.min(1.3, zoomLevel.value + delta))
}

function resetZoom() {
  zoomLevel.value = 1.0
}

watch(chatHistory, () => {
  if (!sessionId.value) return
  clearTimeout(syncTimeout)
  syncTimeout = setTimeout(() => {
    socket.emit('sync_history', { history: JSON.parse(JSON.stringify(chatHistory.value)), logs: JSON.parse(JSON.stringify(runtimeLogs.value)) })
  }, 500)
}, { deep: true })

watch(runtimeLogs, () => {
  missionTrace.value = (Array.isArray(runtimeLogs.value) ? runtimeLogs.value : []).slice(-60).map((entry, idx) => ({
    id: entry.id || `${String(entry.at || Date.now())}_${idx}`,
    at: entry.at || new Date().toISOString(),
    type: entry.type || 'log',
    tool: entry.name || '',
    message: entry.message || '',
    args: entry.args || null
  }))
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
  chatMissionPanel.value?.scrollToBottom?.()
}
async function fetchJson(url, options) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Request failed')
  return data
}

const {
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
} = useSetupAndUsage({
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
  configFallbackLabels: CONFIG_FALLBACK_LABELS,
  llmDefaultValues: LLM_DEFAULT_VALUES
})

const {
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
} = useFinanceOperations({
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
  loadMarketingBriefs: async (clientId = '') => { marketingBriefs.value = (await fetchJson(`/api/marketing/briefs${clientId ? `?clientId=${clientId}` : ''}`)).briefs || [] },
  loadMarketingOutputs: async (clientId = '') => { marketingOutputs.value = (await fetchJson(`/api/marketing/outputs${clientId ? `?clientId=${clientId}` : ''}`)).outputs || [] },
  buildAgencyScopePayload,
  activeView,
  generatedMarketingBrief,
  generatedAuditBundle,
  loadMarketingWorkflows: async () => {
    const data = await fetchJson('/api/marketing/workflows')
    marketingWorkflows.value = data.workflows || []
    marketingAuditSpecialists.value = Object.entries(data.auditSpecialists || {}).map(([id, item]) => ({ id, ...item }))
  }
})

const {
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
} = useMarketingOperations({
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
})

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
  if (agencyQuoteDraft.value.xAdsWeeks > 0) serviceKeys.push('x_ads_management')
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
    xAdsWeeks: active.has('x_ads_management') ? Number(agencyQuoteDraft.value.xAdsWeeks || 0) : 0,
    linkedinAdsWeeks: active.has('linkedin_ads_management') ? Number(agencyQuoteDraft.value.linkedinAdsWeeks || 0) : 0,
    websiteProject: active.has('website_development') ? Boolean(agencyQuoteDraft.value.websiteProject) : false,
    websitePages: active.has('website_development') ? Number(agencyQuoteDraft.value.websitePages || 1) : 1,
    adSpendMonthly: (active.has('meta_ads_management') || active.has('google_ads_management') || active.has('x_ads_management') || active.has('linkedin_ads_management')) ? Number(agencyQuoteDraft.value.adSpendMonthly || 0) : 0,
    profitMarginPct: Number(agencyQuoteDraft.value.profitMarginPct || 0),
    taxPct: Number(agencyQuoteDraft.value.taxPct || 0),
    currency: agencyQuoteDraft.value.currency,
    includeStrategyRetainer: active.has('strategy_retainer') ? Boolean(agencyQuoteDraft.value.includeStrategyRetainer) : false,
    notes: agencyQuoteDraft.value.notes
  }
}


const {
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
} = useChatShellActions({
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
  clientKeyInfo: CLIENT_KEY_INFO,
  clientKeyLabels,
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
  isLikelyContinuationPrompt
})

const { saveClient, manageClientKeys, saveClientKeys, editTool, updateToolConfig, testTool } = useClientAdmin({
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
  llmDefaultValues: LLM_DEFAULT_VALUES,
  fetchJson,
  showToast,
  loadClients,
  saveConfig,
  submitTask,
  promptInput,
  activeView
})

const { mount: mountSocketSession, unmount: unmountSocketSession } = useSocketSession({
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
  syncViewport,
  isWorking
})

onMounted(async () => {
  await mountSocketSession()
})

onBeforeUnmount(() => {
  unmountSocketSession()
})
</script>

<template>
  <v-app class="app-shell" :class="{ compact: isSidebarCollapsed, railHidden: isRailCollapsed }">
    <v-navigation-drawer :app="!isMobileViewport" :model-value="isMobileViewport ? isMobileNavOpen : true"
      :permanent="!isMobileViewport" :temporary="isMobileViewport" :rail="!isMobileViewport && isSidebarCollapsed"
      :width="232" :rail-width="78" class="sidebar app-drawer" @update:model-value="isMobileNavOpen = $event">
      <div class="brand">
        <!-- <div class="brand-mark">
          <span class="brand-mark-text">N</span>
        </div> -->
        <div class="brand-copy">
          <img :src="brandLogoUrl" alt="Nexus OS" class="brand-logo-image" />
        </div>
      </div>
      <v-list class="sidebar-list" bg-color="transparent" nav>
        <v-list-item v-for="item in navItems" :key="item.view" :active="activeView === item.view" class="nav-item"
          rounded="xl" @click="changeView(item.view)">
          <template #prepend>
            <v-avatar size="28" class="nav-avatar">{{ item.icon }}</v-avatar>
          </template>
          <v-list-item-title class="nav-title">{{ item.label }}</v-list-item-title>
          <v-list-item-subtitle class="nav-sub">{{ item.eyebrow }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>
      <div class="sidebar-card"><span class="tiny-label">System - </span>
        <strong>{{ systemHealth.status }}</strong> <br><span class="tiny-copy">Firestore {{ systemHealth.firestore ?
          'connected' : 'offline' }}</span>
      </div>
      <div class="sidebar-card"> <br>
        <span class="tiny-label">Context - </span><strong>{{ activeClientName }}</strong> <br><span
          class="tiny-copy">Session
          {{ sessionId || 'pending' }}</span>
      </div>
    </v-navigation-drawer>

    <v-main class="workspace-main">
      <main class="workspace" :class="{ 'chat-mode': activeView === 'chat' }">
        <header class="topbar">
          <div>
            <p class="eyebrow">{{ currentViewMeta.eyebrow }}</p>
            <h1>{{ currentViewMeta.label }}</h1>
          </div>
          <div class="action-row topbar-actions">
            <v-btn class="ghost desktop-only" rounded="pill" variant="outlined"
              @click="isSidebarCollapsed = !isSidebarCollapsed">
              {{ isSidebarCollapsed ? 'Show Left' : 'Hide Left' }}
            </v-btn>
            <v-btn class="ghost desktop-only" rounded="pill" variant="outlined"
              @click="isRailCollapsed = !isRailCollapsed">
              {{ isRailCollapsed ? 'Show Right' : 'Hide Right' }}
            </v-btn>
            <v-btn v-if="!isRailCollapsed" class="ghost desktop-only" rounded="pill" variant="outlined"
              @click="isSummaryVisible = !isSummaryVisible">
              {{ isSummaryVisible ? 'Hide Overview' : 'Show Overview' }}
            </v-btn>
            <v-btn class="ghost desktop-only" rounded="pill" variant="outlined"
              @click="enableNotifications">Alerts</v-btn>

            <div class="desktop-only zoom-controls action-row">
              <v-btn class="ghost" size="x-small" variant="text" @click="adjustZoom(-0.05)">-</v-btn>
              <v-btn class="ghost" rounded="pill" variant="outlined" size="small" style="min-width: 64px;"
                @click="resetZoom">
                {{ Math.round(zoomLevel * 100) }}%
              </v-btn>
              <v-btn class="ghost" size="x-small" variant="text" @click="adjustZoom(0.05)">+</v-btn>
            </div>

            <v-btn class="ghost desktop-only" rounded="pill" variant="outlined" @click="toggleTheme">{{ theme === 'dark'
              ?
              'Light' : 'Dark' }}</v-btn>
            <v-btn class="ghost mobile-only" rounded="pill" variant="outlined"
              @click="isMobileNavOpen = !isMobileNavOpen">Menu</v-btn>
            <v-btn v-if="activeView === 'chat'" class="ghost mobile-only" rounded="pill" variant="outlined"
              @click="isMobileRailOpen = !isMobileRailOpen">
              {{ isMobileRailOpen ? 'Hide Right Panel' : 'Show Right Panel' }}
            </v-btn>
            <div class="mobile-only mobile-actions-menu">
              <v-menu location="bottom end">
                <template #activator="{ props }">
                  <v-btn class="ghost" rounded="pill" variant="outlined" v-bind="props">More</v-btn>
                </template>
                <v-list density="comfortable" class="mobile-overflow-list">
                  <v-list-item @click="enableNotifications">
                    <v-list-item-title>Alerts</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="toggleTheme">
                    <v-list-item-title>{{ theme === 'dark' ? 'Light Mode' : 'Dark Mode' }}</v-list-item-title>
                  </v-list-item>
                  <v-list-item v-if="activeView !== 'chat'" @click="changeView('chat')">
                    <v-list-item-title>Mission Control</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
            <v-btn v-if="activeView === 'clients'" class="primary" rounded="pill" @click="isAddingClient = true">Add
              Client</v-btn>
            <v-btn v-else class="primary" rounded="pill" @click="startNewOrchestration">New Session</v-btn>
          </div>
        </header>


        <section v-if="activeView !== 'chat'" class="hero-grid compact-bar"
          :class="{ expanded: isRailCollapsed, docked: !isRailCollapsed }">
          <article class="hero-card">
            <span class="tiny-label">Mission posture</span>
            <h2>
              {{ missionStatus === 'active' ? 'Operation in progress' : missionStatus === 'paused' ? 'Awaiting Boss input' : 'Ready for next mission' }}</h2>
            <p class="muted">Run client missions, review outputs, monitor queue health, and track Nexus-tracked usage
              from
              one
              place.</p>
            <div class="pill-row"><span class="pill">{{ missionSummary.totals.missions }} missions</span><span
                class="pill">{{ missionSummary.totals.successRate }}% success</span><span class="pill">{{
                  activeIntegrationCount }} integrations</span><span class="pill">{{
                  dualCurrency(missionSummary.usage?.sessionEstimatedCostUsd || 0) }} est. cost</span></div>
          </article>
          <article class="metric-card compact-metric"><span class="tiny-label">Tools</span><strong>{{
            missionSummary.totals.toolCalls }}</strong>
            <p>Total calls</p>
          </article>
          <article class="metric-card compact-metric"><span class="tiny-label">Queue</span><strong>{{
            missionSummary.queue?.totals?.queued || 0 }}</strong>
            <p>Waiting missions</p>
          </article>
          <article class="metric-card compact-metric"><span class="tiny-label">Usage</span><strong>{{
            missionSummary.totals.llmCalls || 0 }}</strong>
            <p>LLM calls</p>
          </article>
        </section>

        <section v-if="activeView === 'chat'" class="chat-layout">
          <ChatMissionPanel ref="chatMissionPanel" :active-mission-mode="activeMissionMode" :chat-history="chatHistory"
            :clients="clients" :current-blocker="currentBlocker" :current-engine="currentEngine"
            :current-stage="currentStage" :engine-theme-class="engineThemeClass" :format-message="formatMessage"
            :is-voice-listening="isVoiceListening" :is-working="isWorking" :llm-status="llmStatus"
            :mission-status="missionStatus" :mission-mode-override="missionModeOverride"
            :mission-summary="missionSummary" :mission-trace="missionTrace" :mode-routing-hint="modeRoutingHint"
            :output-files="outputFiles" :pending-approval-summary="pendingApprovalSummary" :prompt-input="promptInput"
            :selected-client-for-chat="selectedClientForChat" :suggested-reply-chips="suggestedReplyChips"
            :uploaded-context-files="uploadedContextFiles" @file-upload="handleFileUpload" @reply-chip="useReplyChip"
            @stop-voice="stopVoiceInput" @submit="submitTask" @terminate="terminateTask" @toggle-voice="startVoiceInput"
            @requeue-job="requeueJob" @retry-job="retryJobNow"
            @update:mission-mode-override="missionModeOverride = $event" @update:prompt-input="promptInput = $event"
            @update:selected-client-for-chat="selectedClientForChat = $event" />
          <v-navigation-drawer v-if="(!isMobileViewport && !isRailCollapsed) || (isMobileViewport && isMobileRailOpen)"
            :app="!isMobileViewport" :model-value="isMobileViewport ? isMobileRailOpen : true"
            :permanent="!isMobileViewport" :temporary="isMobileViewport" location="right" :width="272"
            class="rail app-rail-drawer" @update:model-value="isMobileRailOpen = $event">
            <div class="panel summary-panel">
              <div class="panel-head">
                <div><span class="tiny-label">Control Dock</span>
                  <h3>Mission overview</h3>
                </div>
              </div>
              <div class="summary-scroll">
                <article class="hero-card summary-hero">
                  <span class="tiny-label">Mission posture</span>
                  <h2>
                    {{ missionStatus === 'active' ? 'Operation in progress' :
                      missionStatus === 'paused' ? 'Awaiting Boss input' : 'Ready for next mission' }}
                  </h2>
                  <p class="muted">Run client missions, review outputs, monitor queue health, and track estimated usage
                    from one place.</p>
                  <div class="pill-row">
                    <span class="pill">{{ missionSummary.totals.missions }} missions</span>
                    <span class="pill">{{ missionSummary.totals.successRate }}% success</span>
                    <span class="pill">{{ activeIntegrationCount }} integrations</span>
                    <span class="pill">{{ dualCurrency(missionSummary.usage?.sessionEstimatedCostUsd || 0) }} est.
                      cost</span>
                  </div>
                </article>
                <div class="summary-metrics">
                  <article class="metric-card compact-metric"><span class="tiny-label">Tools</span><strong>{{
                    missionSummary.totals.toolCalls }}</strong>
                    <p>Total calls</p>
                  </article>
                  <article class="metric-card compact-metric"><span class="tiny-label">Queue</span><strong>{{
                    missionSummary.queue?.totals?.queued || 0 }}</strong>
                    <p>Waiting missions</p>
                  </article>
                  <article class="metric-card compact-metric"><span class="tiny-label">Usage</span><strong>{{
                    missionSummary.totals.llmCalls || 0 }}</strong>
                    <p>LLM calls</p>
                  </article>
                </div>
              </div>
            </div>
            <div v-if="missionSummary.pendingApproval" class="panel">
              <div class="panel-head">
                <div><span class="tiny-label">Approval gate</span>
                  <h3>Needs your decision</h3>
                </div>
              </div>
              <div class="stack-item">
                <strong>{{ missionSummary.pendingApproval.toolCall?.name }}</strong>
                <p class="muted">{{ missionSummary.pendingApproval.reason }}</p>
                <p class="muted">{{ missionSummary.pendingApproval.preview }}</p>
                <pre v-if="missionSummary.pendingApproval.details" class="approval-json">{{
                  JSON.stringify(missionSummary.pendingApproval.details, null, 2) }}</pre>
              </div>
            </div>
            <div v-if="missionSummary.pendingRepair" class="panel">
              <div class="panel-head">
                <div><span class="tiny-label">Repair</span>
                  <h3>Suggested fix</h3>
                </div>
              </div>
              <div class="stack-item">
                <strong>{{ missionSummary.pendingRepair.classification?.type }}</strong>
                <p class="muted">{{ missionSummary.pendingRepair.classification?.summary }}</p>
                <p class="muted">{{ missionSummary.pendingRepair.playbook?.message }}</p>
              </div>
            </div>
            <div class="panel">
              <div class="panel-head">
                <div><span class="tiny-label">Quick actions</span>
                  <h3>Next moves</h3>
                </div>
              </div>
              <div class="stack-list">
                <div class="stack-item">
                  <strong>{{ selectedClientForChat ? activeClientName : 'Boss workspace' }}</strong>
                  <p class="muted">Use these shortcuts to start structured work faster.</p>
                  <div class="action-row">
                    <v-btn class="ghost" rounded="pill" variant="outlined" @click="changeView('marketing'); promptInput = 'Create a marketing audit for the selected context and stop after the findings summary.'">Create Audit</v-btn>
                    <v-btn class="ghost" rounded="pill" variant="outlined" @click="changeView('finance'); promptInput = 'Generate a quote for the selected context and show me the pricing breakdown before sending.'">Generate Quote</v-btn>
                  </div>
                  <div class="action-row">
                    <v-btn class="ghost" rounded="pill" variant="outlined" @click="changeView('chat'); promptInput = 'Draft an email for the selected context and stop for approval before sending.'">Send Email</v-btn>
                    <v-btn class="ghost" rounded="pill" variant="outlined" @click="changeView('chat'); promptInput = 'Continue the current task from the latest safe point and tell me the next step.'">Continue Task</v-btn>
                  </div>
                </div>
              </div>
            </div>
            <div class="panel">
              <div class="panel-head">
                <div><span class="tiny-label">Queue</span>
                  <h3>Mission queue</h3>
                </div>
              </div>
              <div v-if="recentQueue.length" class="stack-list">
                <div v-for="job in recentQueue" :key="job.id" class="stack-item">
                  <div class="run-head"><strong>{{ job.prompt }}</strong><span class="badge" :class="job.status">{{
                    job.status }}</span></div>
                  <p class="muted">{{ prettyDate(job.createdAt) }} · {{ job.clientId || 'system' }}</p>
                </div>
              </div>
              <p v-else class="muted">Queued missions will appear here.</p>
            </div>
            <div class="panel">
              <div class="panel-head">
                <div><span class="tiny-label">Queue actions</span>
                  <h3>Retry controls</h3>
                </div>
              </div>
              <div
                v-if="recentQueue.some(job => job.status === 'dead_letter' || job.status === 'cancelled' || job.status === 'failed' || job.status === 'retry_wait')"
                class="stack-list">
                <div
                  v-for="job in recentQueue.filter(job => job.status === 'dead_letter' || job.status === 'cancelled' || job.status === 'failed' || job.status === 'retry_wait')"
                  :key="job.id + '-control'" class="stack-item">
                  <div class="run-head"><strong>{{ job.status }}</strong><span>{{ prettyDate(job.createdAt) }}</span>
                  </div>
                  <p class="muted">{{ job.prompt }}</p>
                  <div class="action-row" v-if="job.status === 'retry_wait'"><v-btn class="ghost" rounded="pill"
                      variant="outlined" @click="retryJobNow(job.id)">Retry Now</v-btn></div>
                  <div class="action-row" v-else><v-btn class="ghost" rounded="pill" variant="outlined"
                      @click="requeueJob(job.id)">Requeue</v-btn></div>
                </div>
              </div>
              <p v-else class="muted">No manual queue actions needed right now.</p>
            </div>
            <div class="panel">
              <div class="panel-head">
                <div><span class="tiny-label">Runtime</span>
                  <h3>Provider and mode</h3>
                </div>
              </div>
              <div class="stack-item">
                <strong>{{ llmStatus.provider }}</strong>
                <p class="muted">{{ llmStatus.model }}</p>
              </div>
              <div class="stack-item">
                <strong>Mission mode</strong>
                <p class="muted">Active: {{ activeMissionMode.toUpperCase() }}</p>
                <div class="action-row">
                  <v-select v-model="missionModeOverride"
                    :items="[{ title: 'Chat', value: 'chat' }, { title: 'Execute', value: 'execute' }, { title: 'Auto', value: 'auto' }]"
                    item-title="title" item-value="value" density="comfortable" variant="outlined" hide-details
                    class="usage-select" />
                </div>
              </div>
              <div class="stack-item">
                <strong>Live usage</strong>
                <p class="muted">{{ todayLiveUsage.calls }} model calls in this run · {{ todayLiveUsage.paidCalls }}
                  paid-estimated</p>
                <p class="muted">{{ todayLiveUsage.totalTokens }} total tokens | {{ todayLiveUsage.inputTokens }} in |
                  {{
                    todayLiveUsage.outputTokens }} out</p>
                <p class="muted">{{ dualCurrency(todayLiveUsage.estimatedCostUsd || 0) }} current run est. cost</p>
              </div>
            </div>
            <div class="panel">
              <div class="panel-head">
                <div><span class="tiny-label">Outputs</span>
                  <h3>Files</h3>
                </div><v-btn class="ghost" rounded="pill" variant="outlined"
                  @click="socket.emit('get_outputs')">Refresh</v-btn>
              </div>
              <div v-if="outputFiles.length" class="stack-list"><a v-for="file in outputFiles" :key="file.url"
                  :href="file.url" target="_blank" rel="noreferrer" class="stack-item"><span>{{ file.name
                  }}</span><span>Open</span></a></div>
              <p v-else class="muted">Generated files will appear here.</p>
            </div>
            <div class="panel">
              <div class="panel-head">
                <div><span class="tiny-label">Recent runs</span>
                  <h3>Recent missions</h3>
                </div>
              </div>
              <div v-if="latestRuns.length" class="stack-list">
                <div v-for="run in latestRuns" :key="run.id" class="stack-item">
                  <div class="run-head"><strong>{{ run.requestPreview }}</strong><span class="badge"
                      :class="run.status">{{
                        run.status }}</span></div>
                  <p class="muted">{{ prettyDate(run.startedAt) }} · {{ run.toolCalls || 0 }} tools · {{ run.steps || 0
                  }}
                    steps · ${{ Number(run.estimatedCostUsd || 0).toFixed(4) }}</p>
                  <p class="muted">{{ run.lastLlmProvider || 'Gemini' }} / {{ run.lastLlmModel || 'gemini-2.5-flash' }}
                  </p>
                </div>
              </div>
              <p v-else class="muted">No tracked runs yet.</p>
            </div>
            <div class="panel">
              <div class="panel-head">
                <div><span class="tiny-label">Audit trail</span>
                  <h3>Approvals and risk</h3>
                </div>
              </div>
              <div v-if="recentAudit.length" class="stack-list">
                <div v-for="entry in recentAudit" :key="entry.at + entry.type" class="stack-item">
                  <div class="run-head"><strong>{{ entry.type }}</strong><span>{{ prettyDate(entry.at) }}</span></div>
                  <p class="muted">{{ entry.payload?.tool || 'system' }}</p>
                </div>
              </div>
              <p v-else class="muted">No approval events recorded yet.</p>
            </div>
            <div class="panel">
              <div class="panel-head">
                <div><span class="tiny-label">Recovery log</span>
                  <h3>Repair history</h3>
                </div>
              </div>
              <div v-if="recentRecovery.length" class="stack-list">
                <div v-for="entry in recentRecovery" :key="entry.at + entry.tool" class="stack-item">
                  <div class="run-head"><strong>{{ entry.classification?.type }}</strong><span>{{ prettyDate(entry.at)
                      }}</span></div>
                  <p class="muted">{{ entry.tool }}</p>
                </div>
              </div>
              <p v-else class="muted">No recovery events captured yet.</p>
            </div>
          </v-navigation-drawer>
        </section>

        <ClientsView v-else-if="activeView === 'clients'" :client-usage-summary="clientUsageSummary" :clients="clients"
          :download-usage-report="downloadUsageReport" :dual-currency="dualCurrency" :latest-sessions="latestSessions"
          :load-clients="loadClients" :manage-client-keys="manageClientKeys"
          :launch-marketing-preset="launchMarketingPreset" :pretty-date="prettyDate"
          :refresh-usage-panels="refreshUsagePanels" :selected-finance-client="selectedFinanceClient"
          :set-client-chat-context="setClientChatContext" :usage-period="usagePeriod" @open-chat="changeView('chat')"
          @open-finance="changeView('finance')" @open-marketing="changeView('marketing')"
          @update:selected-finance-client="selectedFinanceClient = $event"
          @update:usage-period="usagePeriod = $event" />

        <FinanceView v-else-if="activeView === 'finance'" :agency-quote-draft="agencyQuoteDraft"
          :agency-quote-presets="AGENCY_QUOTE_PRESETS" :budget-summary="budgetSummary" :clients="clients"
          :create-agency-quote="createAgencyQuote" :create-invoice-from-quote="createInvoiceFromQuote"
          :create-quote="createQuote" :download-invoice="downloadInvoice"
          :download-marketing-deliverable="downloadMarketingDeliverable" :download-quote="downloadQuote"
          :dual-currency="dualCurrency" :format-message="formatMessage" :invoices="invoices"
          :latest-marketing-output="latestMarketingOutput" :launch-deliverable-to-chat="launchDeliverableToChat"
          :load-pnl-report="loadPnlReport" :mark-invoice-paid="markInvoicePaid"
          :open-finance-marketing="openFinanceMarketing" :planned-agency-quote="plannedAgencyQuote"
          :pnl-period="pnlPeriod" :pnl-report="pnlReport" :pricing-catalog="pricingCatalog"
          :preview-agency-quote="previewAgencyQuote" :proactive-proposals="proactiveProposals"
          :proactive-scan-niche="proactiveScanNiche" :quote-draft="quoteDraft" :quotes="quotes"
          :run-proactive-scan="runProactiveScan" :selected-agency-services="selectedAgencyServices"
          :selected-finance-client="selectedFinanceClient" :selected-quote-preset="selectedQuotePreset"
          :send-invoice="sendInvoice" :send-marketing-deliverable="sendMarketingDeliverable" :send-quote="sendQuote"
          :service-selector-options="SERVICE_SELECTOR_OPTIONS" :toggle-agency-service="toggleAgencyService"
          :visible-agency-fields="visibleAgencyFields" @update:pnl-period="pnlPeriod = $event"
          @update:proactive-scan-niche="proactiveScanNiche = $event"
          @update:selected-finance-client="updateSelectedFinanceClient"
          @update:selected-quote-preset="selectedQuotePreset = $event" />
        <MarketingView v-else-if="activeView === 'marketing'" :competitor-input="competitorInput"
          :download-marketing-deliverable="downloadMarketingDeliverable" :generate-audit-bundle="generateAuditBundle"
          :generate-marketing-brief="generateMarketingBrief"
          :generate-marketing-deliverable="generateMarketingDeliverable" :generated-audit-bundle="generatedAuditBundle"
          :generated-marketing-brief="generatedMarketingBrief" :launch-audit-bundle="launchAuditBundle"
          :launch-brief-to-chat="launchBriefToChat" :launch-deliverable-to-chat="launchDeliverableToChat"
          :launch-marketing-brief="launchMarketingBrief" :load-marketing-workflows="loadMarketingWorkflows"
          :marketing-audit-specialists="marketingAuditSpecialists" :marketing-briefs="marketingBriefs"
          :marketing-draft="marketingDraft" :marketing-outputs="marketingOutputs"
          :marketing-utility-results="marketingUtilityResults" :marketing-workflows="marketingWorkflows"
          :pretty-date="prettyDate" :run-competitor-scan="runCompetitorScan" :run-page-analysis="runPageAnalysis"
          :run-social-calendar="runSocialCalendar" :selected-marketing-workflow="selectedMarketingWorkflow"
          :send-marketing-deliverable="sendMarketingDeliverable" :set-generated-audit-bundle="setGeneratedAuditBundle"
          :set-generated-marketing-brief="setGeneratedMarketingBrief" :social-theme="socialTheme"
          :social-weeks="socialWeeks" @update:competitor-input="competitorInput = $event"
          @update:social-theme="socialTheme = $event" @update:social-weeks="socialWeeks = $event" />

        <UsageDashboard v-else-if="activeView === 'usage'" :client-usage-summary="clientUsageSummary" :clients="clients"
          :download-usage-report="downloadUsageReport" :dual-currency="dualCurrency"
          :global-usage-chart="globalUsageChart" :global-usage-summary="globalUsageSummary"
          :most-expensive-client="mostExpensiveClient" :most-expensive-model="mostExpensiveModel"
          :pretty-date="prettyDate" :provider-share-rows="providerShareRows"
          :recent-provider-switches="recentProviderSwitches" :refresh-usage-panels="refreshUsagePanels"
          :selected-finance-client="selectedFinanceClient" :usage-leaders="usageLeaders" :usage-period="usagePeriod"
          @update:selected-finance-client="selectedFinanceClient = $event"
          @update:usage-period="usagePeriod = $event" />

        <SetupCenterView v-else-if="activeView === 'setup'" :alerts-enabled="alertsEnabled"
          :enable-notifications="enableNotifications" :latest-nexus-message="latestNexusMessage"
          :load-setup-center="loadSetupCenter" :open-key-setup-with-nexus="openKeySetupWithNexus"
          :setup-doctor="setupDoctor" :setup-playbooks="setupPlaybooks" @open-clients="changeView('clients')"
          @open-settings="openSettingsView" @open-tools="openToolsView" />

        <ToolsView v-else-if="activeView === 'tools'" :edit-tool="editTool" :load-tools-dashboard="loadToolsDashboard"
          :test-tool="testTool" :tools-data="toolsData" />

        <SettingsView v-else :config-edits="configEdits" :config-groups="configGroups"
          :download-usage-report="downloadUsageReport" :dual-currency="dualCurrency"
          :global-usage-summary="globalUsageSummary" :refresh-usage-panels="refreshUsagePanels"
          :reveal-keys="revealKeys" :save-config="saveConfig" :usage-period="usagePeriod"
          @open-clients="changeView('clients')" @open-tools="changeView('tools')"
          @update:usage-period="usagePeriod = $event" />
        <AddClientModal :is-open="isAddingClient" :new-client="newClient" :client-key-info="CLIENT_KEY_INFO"
          :client-key-editing="clientKeyEditing" :open-key-setup-with-nexus="openKeySetupWithNexus"
          :save-client="saveClient" @close="isAddingClient = false"
          @update:client-key-editing="clientKeyEditing = $event" />
        <ClientKeysModal :active-client="activeClient" :client-key-edits="clientKeyEdits"
          :client-key-info="CLIENT_KEY_INFO" :client-key-labels="clientKeyLabels" :client-keys-list="clientKeysList"
          :is-open="isManagingClientKeys" :open-key-setup-with-nexus="openKeySetupWithNexus"
          :save-client-keys="saveClientKeys" @close="isManagingClientKeys = false" />
        <EditToolModal :active-tool="activeTool" :config-edits="configEdits" :is-open="isEditingTool"
          :test-tool="testTool" :update-tool-config="updateToolConfig" @close="isEditingTool = false" />
        <div v-if="configToast.show" class="toast" :class="configToast.type">{{ configToast.message }}</div>
      </main>
    </v-main>
  </v-app>
</template>