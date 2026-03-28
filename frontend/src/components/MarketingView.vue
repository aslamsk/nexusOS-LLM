<script setup>
const props = defineProps({
  loadMarketingWorkflows: { type: Function, required: true },
  selectedMarketingWorkflow: { type: Object, default: null },
  marketingDraft: { type: Object, required: true },
  marketingAuditSpecialists: { type: Array, required: true },
  generateAuditBundle: { type: Function, required: true },
  launchAuditBundle: { type: Function, required: true },
  marketingWorkflows: { type: Array, required: true },
  generateMarketingBrief: { type: Function, required: true },
  generatedMarketingBrief: { type: String, default: '' },
  launchMarketingBrief: { type: Function, required: true },
  generateMarketingDeliverable: { type: Function, required: true },
  runPageAnalysis: { type: Function, required: true },
  marketingUtilityResults: { type: Object, required: true },
  competitorInput: { type: String, default: '' },
  runCompetitorScan: { type: Function, required: true },
  socialTheme: { type: String, default: '' },
  socialWeeks: { type: Number, default: 4 },
  runSocialCalendar: { type: Function, required: true },
  generatedAuditBundle: { type: String, default: '' },
  setGeneratedAuditBundle: { type: Function, default: null },
  marketingBriefs: { type: Array, required: true },
  prettyDate: { type: Function, required: true },
  setGeneratedMarketingBrief: { type: Function, required: true },
  launchBriefToChat: { type: Function, required: true },
  marketingOutputs: { type: Array, required: true },
  downloadMarketingDeliverable: { type: Function, required: true },
  launchDeliverableToChat: { type: Function, required: true },
  sendMarketingDeliverable: { type: Function, required: true }
})

const emit = defineEmits(['update:competitorInput', 'update:socialTheme', 'update:socialWeeks'])
</script>

<template>
  <section class="grid-two">
    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Marketing</span>
          <h3>Nexus workflow builder</h3>
        </div><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.loadMarketingWorkflows">Refresh</v-btn>
      </div>
      <div v-if="props.selectedMarketingWorkflow" class="mini-card full">
        <div class="run-head"><strong>{{ props.selectedMarketingWorkflow.label }}</strong><span class="badge">{{ props.selectedMarketingWorkflow.category }}</span></div>
        <p class="muted">{{ props.selectedMarketingWorkflow.description }}</p>
        <p class="muted">Expected output: {{ props.selectedMarketingWorkflow.output }}</p>
      </div>
      <div v-if="props.marketingDraft.workflowId === 'audit' && props.marketingAuditSpecialists.length" class="mini-card full">
        <div class="panel-head">
          <div><span class="tiny-label">Audit mode</span>
            <h3>Multi-specialist structure</h3>
          </div>
        </div>
        <div class="card-grid">
          <div v-for="specialist in props.marketingAuditSpecialists" :key="specialist.id" class="stack-item">
            <div class="run-head"><strong>{{ specialist.label }}</strong><span>{{ specialist.id }}</span></div>
            <p class="muted">{{ specialist.focus.join(', ') }}</p>
            <p class="muted">{{ specialist.deliverable }}</p>
          </div>
        </div>
        <div class="action-row"><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.generateAuditBundle">Generate Audit Bundle</v-btn><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.launchAuditBundle">Launch Audit Bundle</v-btn></div>
      </div>
      <div class="card-grid">
        <div class="mini-card"><label>Workflow</label><v-select v-model="props.marketingDraft.workflowId" :items="props.marketingWorkflows.map((workflow) => ({ title: workflow.label, value: workflow.id }))" item-title="title" item-value="value" density="comfortable" variant="outlined" hide-details /></div>
        <div class="mini-card"><label>Target URL / Topic</label><input v-model="props.marketingDraft.target" placeholder="https://clientsite.com or offer/topic"></div>
        <div class="mini-card"><label>Budget</label><input v-model="props.marketingDraft.budget" placeholder="$2,000 monthly or Rs. 1,50,000"></div>
        <div class="mini-card full"><label>Channels</label><input v-model="props.marketingDraft.channels" placeholder="Meta Ads, Google Ads, Email, LinkedIn"><p class="muted">Separate channels with commas.</p></div>
        <div class="mini-card full"><label>Notes</label><textarea v-model="props.marketingDraft.notes" placeholder="Goals, offer details, audience, constraints, deliverable expectations."></textarea></div>
      </div>
      <div class="action-row"><v-btn class="primary" rounded="pill" @click="props.generateMarketingBrief()">Generate Brief</v-btn></div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><span class="tiny-label">Generated brief</span><h3>Mission-ready prompt</h3></div></div>
      <div class="mini-card">
        <textarea :value="props.generatedMarketingBrief" placeholder="Generated marketing workflow brief will appear here." @input="props.setGeneratedMarketingBrief($event.target.value)"></textarea>
        <div class="action-row"><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.launchMarketingBrief">Send To Mission Control</v-btn><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.generateMarketingDeliverable('report')">Generate Report</v-btn><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.generateMarketingDeliverable('proposal')">Generate Proposal</v-btn></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><span class="tiny-label">Utilities</span><h3>Marketing utility tools</h3></div></div>
      <div class="card-grid">
        <div class="mini-card"><label>Page analysis</label><p class="muted">Generate a structured page-readiness snapshot from the current target and notes.</p><div class="action-row"><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.runPageAnalysis">Run</v-btn></div><p v-if="props.marketingUtilityResults.pageAnalysis" class="muted">{{ props.marketingUtilityResults.pageAnalysis.summary }}</p></div>
        <div class="mini-card"><label>Competitors</label><input :value="props.competitorInput" placeholder="competitor.com, brand two, brand three" @input="emit('update:competitorInput', $event.target.value)"><div class="action-row"><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.runCompetitorScan">Scan</v-btn></div><p v-if="props.marketingUtilityResults.competitorScan" class="muted">{{ props.marketingUtilityResults.competitorScan.summary }}</p></div>
        <div class="mini-card"><label>Social theme</label><input :value="props.socialTheme" placeholder="Launch week, trust campaign, lead gen offer" @input="emit('update:socialTheme', $event.target.value)"><label>Weeks</label><input :value="props.socialWeeks" type="number" min="1" max="12" @input="emit('update:socialWeeks', Number($event.target.value || 1))"><div class="action-row"><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.runSocialCalendar">Generate Calendar</v-btn></div><p v-if="props.marketingUtilityResults.socialCalendar" class="muted">{{ props.marketingUtilityResults.socialCalendar.summary }}</p></div>
      </div>
    </div>
    <div v-if="props.marketingDraft.workflowId === 'audit'" class="panel">
      <div class="panel-head"><div><span class="tiny-label">Audit bundle</span><h3>Five-specialist mission pack</h3></div></div>
      <div class="mini-card">
        <textarea :value="props.generatedAuditBundle" placeholder="Generated multi-specialist audit bundle will appear here." @input="props.setGeneratedAuditBundle?.($event.target.value)"></textarea>
        <div class="action-row"><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.launchAuditBundle">Send Audit To Mission Control</v-btn></div>
      </div>
    </div>
    <div v-if="props.marketingUtilityResults.pageAnalysis || props.marketingUtilityResults.competitorScan || props.marketingUtilityResults.socialCalendar" class="panel">
      <div class="panel-head"><div><span class="tiny-label">Utility outputs</span><h3>Structured marketing insights</h3></div></div>
      <div class="stack-list">
        <div v-if="props.marketingUtilityResults.pageAnalysis" class="stack-item"><div class="run-head"><strong>Page analysis</strong><span>{{ props.marketingUtilityResults.pageAnalysis.page?.hostname || props.marketingDraft.target }}</span></div><p class="muted">{{ props.marketingUtilityResults.pageAnalysis.findings?.map((item) => `${item.label}: ${item.score}/10`).join(' · ') }}</p></div>
        <div v-if="props.marketingUtilityResults.competitorScan" class="stack-item"><div class="run-head"><strong>Competitor scan</strong><span>{{ props.marketingUtilityResults.competitorScan.competitorCount }} competitors</span></div><p class="muted">{{ props.marketingUtilityResults.competitorScan.rows?.slice(0, 2).map((item) => `${item.competitor}: ${item.opportunity}`).join(' | ') }}</p></div>
        <div v-if="props.marketingUtilityResults.socialCalendar" class="stack-item"><div class="run-head"><strong>Social calendar</strong><span>{{ props.marketingUtilityResults.socialCalendar.weeks }} weeks</span></div><p class="muted">{{ props.marketingUtilityResults.socialCalendar.posts?.slice(0, 2).map((item) => `${item.hook} (${item.format})`).join(' | ') }}</p></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><span class="tiny-label">Brief memory</span><h3>Saved marketing briefs</h3></div></div>
      <div v-if="props.marketingBriefs.length" class="stack-list">
        <div v-for="item in props.marketingBriefs.slice(0, 6)" :key="item.id" class="stack-item">
          <div class="run-head"><strong>{{ item.workflowId }}</strong><span>{{ props.prettyDate(item.createdAt?.seconds ? item.createdAt.seconds * 1000 : item.createdAt) }}</span></div>
          <p class="muted">{{ item.target || 'No target specified' }}</p>
          <div class="action-row"><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.setGeneratedMarketingBrief(item.brief)">Load Brief</v-btn><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.launchBriefToChat(item.brief)">Launch</v-btn></div>
        </div>
      </div>
      <p v-else class="muted">Saved workflow briefs will appear here.</p>
    </div>
    <div class="panel">
      <div class="panel-head"><div><span class="tiny-label">Deliverables</span><h3>Generated marketing files</h3></div></div>
      <div v-if="props.marketingOutputs.length" class="stack-list">
        <div v-for="item in props.marketingOutputs.slice(0, 8)" :key="item.id || item.url" class="stack-item">
          <div class="run-head"><strong>{{ item.type }}</strong><span>{{ item.workflowId }}</span></div>
          <p class="muted">{{ item.fileName }}</p>
          <div class="action-row"><a :href="item.url" target="_blank" rel="noreferrer" class="link-btn">Open</a><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.downloadMarketingDeliverable(item, 'pdf')">PDF</v-btn><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.launchDeliverableToChat(item)">Use In Mission</v-btn><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.sendMarketingDeliverable(item)">Send To Client</v-btn></div>
        </div>
      </div>
      <p v-else class="muted">No marketing deliverables generated yet.</p>
    </div>
  </section>
</template>
