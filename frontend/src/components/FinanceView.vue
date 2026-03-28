<script setup>
const props = defineProps({
  proactiveScanNiche: { type: String, default: '' },
  runProactiveScan: { type: Function, required: true },
  proactiveProposals: { type: Array, required: true },
  formatMessage: { type: Function, required: true },
  pnlPeriod: { type: String, default: 'all' },
  loadPnlReport: { type: Function, required: true },
  pnlReport: { type: Object, required: true },
  dualCurrency: { type: Function, required: true },
  selectedQuotePreset: { type: String, default: 'custom' },
  agencyQuotePresets: { type: Object, required: true },
  applyQuotePreset: { type: Function, required: true },
  serviceSelectorOptions: { type: Array, required: true },
  selectedAgencyServices: { type: Array, required: true },
  toggleAgencyService: { type: Function, required: true },
  visibleAgencyFields: { type: Object, required: true },
  agencyQuoteDraft: { type: Object, required: true },
  previewAgencyQuote: { type: Function, required: true },
  createAgencyQuote: { type: Function, required: true },
  plannedAgencyQuote: { type: Object, default: null },
  clients: { type: Array, required: true },
  selectedFinanceClient: { type: String, default: '' },
  pricingCatalog: { type: Object, required: true },
  quoteDraft: { type: Object, required: true },
  createQuote: { type: Function, required: true },
  budgetSummary: { type: Object, required: true },
  quotes: { type: Array, required: true },
  downloadQuote: { type: Function, required: true },
  sendQuote: { type: Function, required: true },
  createInvoiceFromQuote: { type: Function, required: true },
  openFinanceMarketing: { type: Function, required: true },
  latestMarketingOutput: { type: Object, default: null },
  downloadMarketingDeliverable: { type: Function, required: true },
  launchDeliverableToChat: { type: Function, required: true },
  sendMarketingDeliverable: { type: Function, required: true },
  invoices: { type: Array, required: true },
  downloadInvoice: { type: Function, required: true },
  sendInvoice: { type: Function, required: true },
  markInvoicePaid: { type: Function, required: true }
})

const emit = defineEmits([
  'update:proactiveScanNiche',
  'update:pnlPeriod',
  'update:selectedQuotePreset',
  'update:selectedFinanceClient'
])
</script>

<template>
  <section class="grid-two">
    <div class="panel full-span-panel">
      <div class="panel-head">
        <div><span class="tiny-label">Proactive Intelligence</span>
          <h3>Market Scanner & Proposals</h3>
        </div>
      </div>
      <div class="mini-card">
        <div class="run-head">
          <v-text-field :model-value="props.proactiveScanNiche" placeholder="Enter niche (e.g. ethnic fashion)" class="inline-grow-input" density="comfortable" variant="outlined" hide-details @update:model-value="emit('update:proactiveScanNiche', $event)" />
          <v-btn class="primary" rounded="pill" @click="props.runProactiveScan">Scan & Propose</v-btn>
        </div>
        <p class="muted">The agent will autonomously scan market trends and generate a campaign proposal.</p>
      </div>
      <div v-if="props.proactiveProposals.length" class="stack-list">
        <div v-for="(p, i) in props.proactiveProposals.slice(0, 5)" :key="i" class="stack-item">
          <div class="run-head"><strong>{{ p.type === 'new_client_onboarding' ? 'New Client ' + (p.clientName || '') : 'Campaign Proposal' }}</strong><span class="badge success">{{ p.type || 'scan' }}</span></div>
          <p v-if="p.message" class="muted">{{ p.message }}</p>
          <div v-if="p.proposal" class="message-text" v-html="props.formatMessage(p.proposal)"></div>
          <p class="muted">{{ new Date(p.receivedAt).toLocaleString() }}</p>
        </div>
      </div>
      <p v-else class="muted">No proposals yet. Use the scanner above or wait for proactive agent insights.</p>
    </div>

    <div class="panel full-span-panel">
      <div class="panel-head">
        <div><span class="tiny-label">Financial Intelligence</span>
          <h3>Live Profit & Loss Dashboard</h3>
        </div>
        <div class="run-head">
          <v-select :model-value="props.pnlPeriod" :items="[{ title: 'All Time', value: 'all' }, { title: 'This Month', value: 'month' }, { title: 'This Week', value: 'week' }, { title: 'Today', value: 'today' }]" item-title="title" item-value="value" density="comfortable" variant="outlined" hide-details class="usage-select" @update:model-value="emit('update:pnlPeriod', $event); props.loadPnlReport()" />
        </div>
      </div>
      <div class="summary-metrics">
        <article class="metric-card compact-metric"><span class="tiny-label">Revenue</span><strong class="metric-positive">{{ props.dualCurrency(props.pnlReport.totalRevenue || 0) }}</strong><p>Total earned</p></article>
        <article class="metric-card compact-metric"><span class="tiny-label">Expenses</span><strong class="metric-negative">{{ props.dualCurrency(props.pnlReport.totalExpenses || 0) }}</strong><p>API + Ads + Ops</p></article>
        <article class="metric-card compact-metric"><span class="tiny-label">Net Profit</span><strong :class="(props.pnlReport.netProfit || 0) >= 0 ? 'metric-positive' : 'metric-negative'">{{ props.dualCurrency(props.pnlReport.netProfit || 0) }}</strong><p>{{ props.pnlReport.profitMargin || 0 }}% margin</p></article>
        <article class="metric-card compact-metric"><span class="tiny-label">Transactions</span><strong>{{ props.pnlReport.transactionCount || 0 }}</strong><p>Total entries</p></article>
      </div>
      <div v-if="Object.keys(props.pnlReport.expensesByProvider || {}).length" class="mini-card">
        <label>Expenses by Provider</label>
        <div class="pill-row">
          <span v-for="(amount, provider) in props.pnlReport.expensesByProvider" :key="provider" class="pill">{{ provider }}: {{ props.dualCurrency(amount) }}</span>
        </div>
      </div>
      <div v-if="(props.pnlReport.recentTransactions || []).length" class="stack-list">
        <div v-for="txn in props.pnlReport.recentTransactions" :key="txn.id" class="stack-item">
          <div class="run-head"><strong>{{ txn.description || txn.provider || 'Transaction' }}</strong><span class="badge" :class="txn.type === 'revenue' ? 'success' : 'warning'">{{ txn.type }}</span></div>
          <p class="muted">{{ props.dualCurrency(txn.amount) }} · {{ new Date(txn.timestamp).toLocaleString() }}</p>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Agency planner</span>
          <h3>Recurring quote builder</h3>
        </div>
      </div>
      <div class="mini-card">
        <label>Preset package</label>
        <div class="run-head">
          <v-select :model-value="props.selectedQuotePreset" :items="Object.entries(props.agencyQuotePresets).map(([key, preset]) => ({ title: preset.label, value: key }))" item-title="title" item-value="value" density="comfortable" variant="outlined" hide-details class="inline-grow-input" @update:model-value="emit('update:selectedQuotePreset', $event)" />
          <v-btn class="ghost" rounded="pill" variant="outlined" @click="props.applyQuotePreset">Apply Preset</v-btn>
        </div>
        <p class="muted">{{ props.agencyQuotePresets[props.selectedQuotePreset]?.description }}</p>
      </div>
      <div class="mini-card">
        <label>Service mix</label>
        <div class="pill-row selectable-pills">
          <button v-for="option in props.serviceSelectorOptions" :key="option.key" class="pill selector-pill" :class="{ active: props.selectedAgencyServices.includes(option.key) }" @click="props.toggleAgencyService(option.key)">
            {{ option.label }}
          </button>
        </div>
        <p class="muted">Mix design, marketing, development, reporting, and promotion services in one commercial quote.</p>
      </div>
      <div class="card-grid">
        <div class="mini-card"><label>Campaign</label><input v-model="props.agencyQuoteDraft.campaignName" placeholder="Monthly Meta ads package"></div>
        <div v-if="props.visibleAgencyFields.has('bannerCount')" class="mini-card"><label>Banner count</label><input v-model="props.agencyQuoteDraft.bannerCount" type="number" min="0"></div>
        <div v-if="props.visibleAgencyFields.has('carouselCount')" class="mini-card"><label>Carousel count</label><input v-model="props.agencyQuoteDraft.carouselCount" type="number" min="0"></div>
        <div v-if="props.visibleAgencyFields.has('videoCount')" class="mini-card"><label>Video count</label><input v-model="props.agencyQuoteDraft.videoCount" type="number" min="0"></div>
        <div v-if="props.visibleAgencyFields.has('contentDeliverables')" class="mini-card"><label>Content deliverables</label><input v-model="props.agencyQuoteDraft.contentDeliverables" type="number" min="0"></div>
        <div v-if="props.visibleAgencyFields.has('tagPackages')" class="mini-card"><label>Tag / hashtag packs</label><input v-model="props.agencyQuoteDraft.tagPackages" type="number" min="0"></div>
        <div v-if="props.visibleAgencyFields.has('reportCount')" class="mini-card"><label>Reports</label><input v-model="props.agencyQuoteDraft.reportCount" type="number" min="0"></div>
        <div v-if="props.visibleAgencyFields.has('auditCount')" class="mini-card"><label>Audits</label><input v-model="props.agencyQuoteDraft.auditCount" type="number" min="0"></div>
        <div v-if="props.visibleAgencyFields.has('metaAdsWeeks')" class="mini-card"><label>Meta ads weeks</label><input v-model="props.agencyQuoteDraft.metaAdsWeeks" type="number" min="0"></div>
        <div v-if="props.visibleAgencyFields.has('googleAdsWeeks')" class="mini-card"><label>Google ads weeks</label><input v-model="props.agencyQuoteDraft.googleAdsWeeks" type="number" min="0"></div>
        <div v-if="props.visibleAgencyFields.has('linkedinAdsWeeks')" class="mini-card"><label>LinkedIn ads weeks</label><input v-model="props.agencyQuoteDraft.linkedinAdsWeeks" type="number" min="0"></div>
        <div v-if="props.visibleAgencyFields.has('websiteProject')" class="mini-card"><label>Website project</label><v-select v-model="props.agencyQuoteDraft.websiteProject" :items="[{ title: 'No', value: false }, { title: 'Yes', value: true }]" item-title="title" item-value="value" density="comfortable" variant="outlined" hide-details /></div>
        <div v-if="props.visibleAgencyFields.has('websitePages')" class="mini-card"><label>Website pages</label><input v-model="props.agencyQuoteDraft.websitePages" type="number" min="1"></div>
        <div v-if="props.visibleAgencyFields.has('adSpendMonthly')" class="mini-card"><label>Ad spend / month</label><input v-model="props.agencyQuoteDraft.adSpendMonthly" type="number" min="0" step="0.01"></div>
        <div class="mini-card"><label>Profit %</label><input v-model="props.agencyQuoteDraft.profitMarginPct" type="number" min="0"></div>
        <div class="mini-card"><label>Tax %</label><input v-model="props.agencyQuoteDraft.taxPct" type="number" min="0"></div>
        <div class="mini-card"><label>Currency</label><v-select v-model="props.agencyQuoteDraft.currency" :items="[{ title: 'USD', value: 'USD' }, { title: 'INR', value: 'INR' }]" item-title="title" item-value="value" density="comfortable" variant="outlined" hide-details /></div>
        <div v-if="props.visibleAgencyFields.has('includeStrategyRetainer')" class="mini-card"><label>Strategy retainer</label><v-select v-model="props.agencyQuoteDraft.includeStrategyRetainer" :items="[{ title: 'Yes', value: true }, { title: 'No', value: false }]" item-title="title" item-value="value" density="comfortable" variant="outlined" hide-details /></div>
        <div class="mini-card full"><label>Notes</label><textarea v-model="props.agencyQuoteDraft.notes" placeholder="Client scope, exclusions, launch window, offer notes, approval terms."></textarea></div>
      </div>
      <div class="action-row"><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.previewAgencyQuote">Preview Plan</v-btn><v-btn class="primary" rounded="pill" @click="props.createAgencyQuote">Create Agency Quote</v-btn></div>
      <div v-if="props.plannedAgencyQuote" class="stack-list">
        <div class="stack-item"><strong>{{ props.plannedAgencyQuote.title }}</strong>
          <p class="muted">Banners {{ props.plannedAgencyQuote.summary.bannerCount }} · Carousels {{ props.plannedAgencyQuote.summary.carouselCount }} · Videos {{ props.plannedAgencyQuote.summary.videoCount }} · Content {{ props.plannedAgencyQuote.summary.contentDeliverables }}</p>
          <p class="muted">Channels: {{ (props.plannedAgencyQuote.summary.activeChannels || []).join(', ') || 'No paid promotion selected' }}</p>
          <p class="muted">AI ops estimate: {{ props.dualCurrency(props.plannedAgencyQuote.aiOps.totalCost || 0) }} · Nexus platform fee: {{ props.dualCurrency(props.plannedAgencyQuote.platformFee || 0) }}</p>
          <p class="muted">Quoted total: {{ props.dualCurrency(props.plannedAgencyQuote.pricing?.total || 0) }}</p>
        </div>
        <div class="stack-item"><strong>Assumptions</strong><p v-for="line in props.plannedAgencyQuote.assumptions" :key="line" class="muted">{{ line }}</p></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Finance</span><h3>Quote and invoice control</h3></div>
        <div class="context-box"><label>Client</label><v-select :model-value="props.selectedFinanceClient" :items="[{ title: 'Select Client', value: '' }, ...props.clients.map((client) => ({ title: client.name, value: client.id }))]" item-title="title" item-value="value" density="comfortable" variant="outlined" hide-details @update:model-value="emit('update:selectedFinanceClient', $event)" /></div>
      </div>
      <div class="card-grid">
        <div class="mini-card"><label>Service</label><v-select v-model="props.quoteDraft.items[0].serviceCode" :items="Object.entries(props.pricingCatalog).map(([code, info]) => ({ title: info.label, value: code }))" item-title="title" item-value="value" density="comfortable" variant="outlined" hide-details /></div>
        <div class="mini-card"><label>Quantity</label><input v-model="props.quoteDraft.items[0].quantity" type="number" min="1"></div>
        <div class="mini-card"><label>Profit %</label><input v-model="props.quoteDraft.profitMarginPct" type="number" min="0"></div>
        <div class="mini-card"><label>Tax %</label><input v-model="props.quoteDraft.taxPct" type="number" min="0"></div>
        <div class="mini-card full"><label>Notes</label><textarea v-model="props.quoteDraft.notes" placeholder="Scope, timelines, add-ons, approval notes."></textarea></div>
      </div>
      <div class="action-row"><v-btn class="primary" rounded="pill" @click="props.createQuote">Create Quote</v-btn></div>
    </div>

    <div class="panel"><div class="panel-head"><div><span class="tiny-label">Budget</span><h3>Client budget status</h3></div></div>
      <div class="stack-list">
        <div class="stack-item"><strong>Allocated</strong><p class="muted">{{ props.dualCurrency(props.budgetSummary.allocated || 0) }}</p></div>
        <div class="stack-item"><strong>Approved Overage</strong><p class="muted">{{ props.dualCurrency(props.budgetSummary.approvedOverage || 0) }}</p></div>
        <div class="stack-item"><strong>Spent</strong><p class="muted">{{ props.dualCurrency(props.budgetSummary.spent || 0) }}</p></div>
        <div class="stack-item"><strong>Remaining</strong><p class="muted">{{ props.dualCurrency(props.budgetSummary.remaining || 0) }}</p><p v-if="props.budgetSummary.requiresBossApproval" class="muted">Boss approval required for excess work.</p></div>
      </div>
    </div>

    <div class="panel"><div class="panel-head"><div><span class="tiny-label">Quotes</span><h3>Prepared offers</h3></div></div>
      <div v-if="props.quotes.length" class="stack-list">
        <div v-for="quote in props.quotes.slice(0, 6)" :key="quote.id" class="stack-item">
          <div class="run-head"><strong>{{ quote.planner?.campaignName || quote.pricing?.items?.[0]?.description || 'Quote' }}</strong><span class="badge">{{ quote.status }}</span></div>
          <p class="muted">{{ props.dualCurrency(quote.pricing?.total || 0) }}</p>
          <div class="action-row"><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.downloadQuote(quote.id, 'pdf')">PDF</v-btn><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.downloadQuote(quote.id, 'csv')">Excel</v-btn><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.sendQuote(quote.id)">Send</v-btn><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.createInvoiceFromQuote(quote.id)">Create Invoice</v-btn></div>
        </div>
      </div>
      <p v-else class="muted">No quotes yet.</p>
    </div>

    <div class="panel"><div class="panel-head"><div><span class="tiny-label">Marketing delivery</span><h3>Proposal and report bridge</h3></div></div>
      <div class="stack-list">
        <div class="stack-item">
          <strong>Client-facing documents</strong>
          <p class="muted">Generate professional proposals and reports from the selected client context, then route them into finance or mission execution.</p>
          <div class="action-row"><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.openFinanceMarketing('proposal')">New Proposal</v-btn><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.openFinanceMarketing('report')">New Report</v-btn></div>
        </div>
        <div v-if="props.latestMarketingOutput" class="stack-item">
          <strong>Latest marketing output</strong>
          <p class="muted">{{ props.latestMarketingOutput.fileName }}</p>
          <div class="action-row"><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.downloadMarketingDeliverable(props.latestMarketingOutput, 'pdf')">PDF</v-btn><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.launchDeliverableToChat(props.latestMarketingOutput)">Use In Mission</v-btn><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.sendMarketingDeliverable(props.latestMarketingOutput)">Send To Client</v-btn></div>
        </div>
      </div>
    </div>

    <div class="panel"><div class="panel-head"><div><span class="tiny-label">Invoices</span><h3>Payment status</h3></div></div>
      <div v-if="props.invoices.length" class="stack-list">
        <div v-for="invoice in props.invoices.slice(0, 6)" :key="invoice.id" class="stack-item">
          <div class="run-head"><strong>Invoice {{ invoice.id.slice(0, 8) }}</strong><span class="badge" :class="invoice.status === 'paid' ? 'success' : 'warning'">{{ invoice.status }}</span></div>
          <p class="muted">{{ props.dualCurrency(invoice.pricing?.total || 0) }} · <a :href="invoice.paymentUrl" target="_blank" rel="noreferrer">Pay</a></p>
          <div class="action-row"><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.downloadInvoice(invoice.id, 'pdf')">PDF</v-btn><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.downloadInvoice(invoice.id, 'csv')">Excel</v-btn><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.sendInvoice(invoice.id)">Send</v-btn><v-btn v-if="invoice.status !== 'paid'" class="ghost" rounded="pill" variant="outlined" @click="props.markInvoicePaid(invoice.id)">Mark Paid</v-btn></div>
        </div>
      </div>
      <p v-else class="muted">No invoices yet.</p>
    </div>
  </section>
</template>
