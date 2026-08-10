<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useChecklist, type RequestTypeOption } from '~/composables/useChecklist'

const { listRequestTypes, createSubmission } = useChecklist()
const router = useRouter()

const types = ref<RequestTypeOption[]>([])
const loading = ref(true)
const creating = ref<string | null>(null)
const isAbroad = ref(false)

const employeeName = ref('')
const employeeEmail = ref('')

const ABROAD_ELIGIBLE = ['study_leave', 'foreign_travel']

const infoComplete = computed(() => {
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employeeEmail.value.trim())
  return employeeName.value.trim().length >= 2 && emailValid
})

onMounted(async () => {
  types.value = await listRequestTypes()
  loading.value = false
})

async function start(type: string) {
  if (!infoComplete.value) return
  creating.value = type
  try {
    const submission = await createSubmission(
      type,
      isAbroad.value,
      employeeName.value.trim(),
      employeeEmail.value.trim(),
    )
    router.push(`/submit/${submission.id}`)
  } finally {
    creating.value = null
  }
}
</script>

<template>
  <div class="page">
    <header class="masthead">
      <div class="seal" aria-hidden="true">CSU</div>
      <div class="masthead-text">
        <p class="eyebrow">Caraga State University · HRMS</p>
        <h1>Leave &amp; Travel Requirements</h1>
        <p class="sub">Enter your details, then select the type of request you're filing. We'll show you exactly what to submit and track it as you upload.</p>
      </div>
    </header>

    <section class="info-panel">
      <div class="info-field">
        <label for="employeeName">Full Name</label>
        <input id="employeeName" v-model="employeeName" type="text" placeholder="Juan Dela Cruz" />
      </div>
      <div class="info-field">
        <label for="employeeEmail">Email Address</label>
        <input id="employeeEmail" v-model="employeeEmail" type="email" placeholder="juan.delacruz@carsu.edu.ph" />
      </div>
    </section>

    <section class="ledger">
      <div v-if="loading" class="loading">Loading request types…</div>

      <ol v-else class="type-list">
        <li v-for="(t, idx) in types" :key="t.type" class="type-row">
          <span class="row-index">{{ String(idx + 1).padStart(2, '0') }}</span>
          <div class="row-body">
            <span class="row-label">{{ t.label }}</span>
            <label v-if="ABROAD_ELIGIBLE.includes(t.type)" class="abroad-toggle">
              <input type="checkbox" v-model="isAbroad" />
              This is for travel/study abroad (adds CHED IAS Assessment)
            </label>
          </div>
          <button
            class="start-btn"
            :disabled="creating === t.type || !infoComplete"
            :title="!infoComplete ? 'Fill in your name and email first' : ''"
            @click="start(t.type)"
          >
            {{ creating === t.type ? 'Starting…' : 'Start' }}
          </button>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.page {
  --ink: #1b2a4a;
  --ink-soft: #3c4a68;
  --paper: #f6f4ee;
  --paper-line: #dcd6c6;
  --brass: #a9803f;
  --brass-deep: #7c5c2a;
  min-height: 100vh;
  background: var(--ink);
  font-family: 'Inter', system-ui, sans-serif;
  padding: 48px 24px 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.masthead {
  max-width: 720px;
  width: 100%;
  display: flex;
  gap: 20px;
  align-items: flex-start;
  margin-bottom: 24px;
}
.seal {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid var(--brass);
  color: var(--brass);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Georgia', serif;
  font-weight: 700;
  letter-spacing: 0.05em;
  font-size: 14px;
}
.eyebrow {
  color: var(--brass);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 12px;
  margin: 0 0 6px;
}
h1 {
  font-family: 'Georgia', 'Iowan Old Style', serif;
  color: #f6f4ee;
  font-size: 30px;
  margin: 0 0 8px;
  font-weight: 600;
}
.sub {
  color: #c7cede;
  font-size: 14.5px;
  line-height: 1.5;
  margin: 0;
  max-width: 52ch;
}

.info-panel {
  max-width: 720px;
  width: 100%;
  display: flex;
  gap: 16px;
  background: var(--paper);
  border-radius: 4px;
  padding: 18px 24px;
  margin-bottom: 16px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
}
.info-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.info-field label {
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-soft);
  font-weight: 600;
}
.info-field input {
  border: 1px solid var(--paper-line);
  border-radius: 3px;
  padding: 8px 10px;
  font-size: 14px;
  color: var(--ink);
  font-family: inherit;
  background: #fff;
}
.info-field input:focus {
  outline: 2px solid var(--brass);
  outline-offset: 1px;
}

.ledger {
  max-width: 720px;
  width: 100%;
  background: var(--paper);
  border-radius: 4px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
  padding: 8px 0;
}
.loading {
  padding: 40px;
  text-align: center;
  color: var(--ink-soft);
}
.type-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.type-row {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 18px 24px;
  border-bottom: 1px solid var(--paper-line);
}
.type-row:last-child {
  border-bottom: none;
}
.row-index {
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  color: var(--brass-deep);
  font-size: 13px;
  width: 24px;
  flex-shrink: 0;
}
.row-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row-label {
  color: var(--ink);
  font-size: 15.5px;
  font-weight: 600;
}
.abroad-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--ink-soft);
  font-weight: 400;
}
.start-btn {
  flex-shrink: 0;
  background: var(--ink);
  color: #f6f4ee;
  border: none;
  padding: 10px 18px;
  border-radius: 3px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}
.start-btn:hover:not(:disabled) {
  background: var(--brass-deep);
}
.start-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>