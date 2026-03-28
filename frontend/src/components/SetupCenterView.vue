<script setup>
const props = defineProps({
  loadSetupCenter: { type: Function, required: true },
  latestNexusMessage: { type: String, default: '' },
  setupPlaybooks: { type: Array, required: true },
  openKeySetupWithNexus: { type: Function, required: true },
  setupDoctor: { type: Object, required: true },
  enableNotifications: { type: Function, required: true },
  alertsEnabled: { type: Boolean, default: false }
})

const emit = defineEmits(['open-settings', 'open-tools'])
</script>

<template>
  <section class="grid-two">
    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Setup Center</span>
          <h3>Provider onboarding and resume</h3>
        </div>
        <v-btn class="ghost" rounded="pill" variant="outlined" @click="props.loadSetupCenter(props.latestNexusMessage)">Refresh Doctor</v-btn>
      </div>
      <div class="stack-list">
        <div class="stack-item">
          <strong>Guided onboarding</strong>
          <p class="muted">Launch provider setup missions directly from Nexus. If login, OTP, MFA, or account selection is needed, answer in chat and Nexus should continue the same setup flow.</p>
        </div>
        <div v-for="playbook in props.setupPlaybooks" :key="`setup-${playbook.key}`" class="stack-item">
          <div class="run-head"><strong>{{ playbook.title }}</strong><span class="badge">{{ playbook.key }}</span></div>
          <p class="muted">{{ playbook.description }}</p>
          <p class="muted">Provider: {{ playbook.provider }} · Category: {{ playbook.category }}</p>
          <p class="muted">Steps: {{ playbook.steps?.join(' -> ') }}</p>
          <div class="action-row">
            <v-btn class="primary subtle" rounded="pill" @click="props.openKeySetupWithNexus(playbook.key)">Start Setup</v-btn>
            <v-btn class="ghost" rounded="pill" variant="outlined" @click="window.open(playbook.url, '_blank')">Open Provider</v-btn>
            <v-btn class="ghost" rounded="pill" variant="outlined" @click="emit('open-settings')">Open Settings</v-btn>
          </div>
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <div><span class="tiny-label">Setup Doctor</span>
          <h3>Blockers before they break a task</h3>
        </div>
      </div>
      <div class="stack-list">
        <div class="stack-item">
          <strong>Status: {{ props.setupDoctor.summary.status }}</strong>
          <p class="muted">{{ props.setupDoctor.summary.message }}</p>
        </div>
        <div v-for="blocker in props.setupDoctor.blockers" :key="blocker.code" class="stack-item">
          <div class="run-head"><strong>{{ blocker.title }}</strong><span class="badge" :class="blocker.severity === 'critical' ? 'warning' : ''">{{ blocker.severity }}</span></div>
          <p class="muted">{{ blocker.detail }}</p>
          <p class="muted">{{ blocker.impact }}</p>
          <div class="action-row">
            <v-btn v-if="blocker.playbook?.key" class="primary subtle" rounded="pill" @click="props.openKeySetupWithNexus(blocker.playbook.key)">Guide Me</v-btn>
            <v-btn v-else class="ghost" rounded="pill" variant="outlined" @click="emit('open-tools')">Open Capabilities</v-btn>
          </div>
        </div>
        <div class="stack-item">
          <strong>Boss alerts</strong>
          <p class="muted">When enabled, Nexus sends local notifications for tool actions, results, approvals needed, errors, and mission completion.</p>
          <div class="action-row"><v-btn class="ghost" rounded="pill" variant="outlined" @click="props.enableNotifications">{{ props.alertsEnabled ? 'Alerts Enabled' : 'Enable Alerts' }}</v-btn></div>
        </div>
        <div class="stack-item">
          <strong>Resume behavior</strong>
          <p class="muted">Setup flows should stay inside the same mission. If Nexus needs your input in the middle, reply in chat and it should resume instead of breaking the workflow.</p>
        </div>
      </div>
    </div>
  </section>
</template>
