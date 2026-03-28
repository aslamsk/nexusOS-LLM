<script setup>
defineProps({
  isOpen: { type: Boolean, default: false },
  newClient: { type: Object, required: true },
  clientKeyInfo: { type: Object, required: true },
  clientKeyEditing: { type: String, default: '' },
  openKeySetupWithNexus: { type: Function, required: true },
  saveClient: { type: Function, required: true }
})

const emit = defineEmits(['close', 'update:clientKeyEditing'])
</script>

<template>
  <transition name="fade">
    <div v-if="isOpen" class="modal-backdrop" @click.self="emit('close')">
      <div class="modal-card">
        <div class="panel-head">
          <div><span class="tiny-label">New client</span>
            <h3>Create isolated operating context</h3>
          </div>
          <v-btn class="ghost" rounded="pill" variant="outlined" @click="emit('close')">Close</v-btn>
        </div>
        <div class="card-grid">
          <div class="mini-card"><label>Name</label><input v-model="newClient.name" placeholder="Acme Growth"></div>
          <div class="mini-card"><label>Company</label><input v-model="newClient.company" placeholder="Acme Pvt Ltd"></div>
          <div class="mini-card"><label>Email</label><input v-model="newClient.email" placeholder="team@acme.com"></div>
          <div class="mini-card"><label>Phone</label><input v-model="newClient.phone" placeholder="+91..."></div>
          <div class="mini-card full"><label>Notes</label><textarea v-model="newClient.notes" placeholder="Brand, goals, constraints, operating notes."></textarea></div>
          <div v-for="(info, key) in clientKeyInfo" :key="key" class="mini-card">
            <div class="run-head">
              <label>{{ info.label }}</label>
              <button class="link-btn" @click="emit('update:clientKeyEditing', clientKeyEditing === key ? '' : key)">How to get</button>
            </div>
            <p v-if="clientKeyEditing === key" class="muted">{{ info.howTo }}</p>
            <div class="action-row compact-row">
              <v-btn class="ghost" rounded="pill" variant="outlined" @click="openKeySetupWithNexus(key)">Set up with Nexus</v-btn>
            </div>
            <input type="password" v-model="newClient.initialKeys[key]" :placeholder="info.placeholder">
          </div>
        </div>
        <div class="action-row">
          <v-btn class="ghost" rounded="pill" variant="outlined" @click="emit('close')">Cancel</v-btn>
          <v-btn class="primary" rounded="pill" @click="saveClient">Create Client</v-btn>
        </div>
      </div>
    </div>
  </transition>
</template>
