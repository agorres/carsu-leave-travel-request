<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useChecklist, type Submission } from '~/composables/useChecklist'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ middleware: 'auth' })

const { listMySubmissions } = useChecklist()
const { user, logout } = useAuth()
const router = useRouter()

const submissions = ref<Submission[]>([])
const loading = ref(true)
const loadError = ref('')

const REQUEST_TYPE_LABELS: Record<string, string> = {
  study_leave: 'Study Leave',
  foreign_travel: 'Foreign Travel',
  personal_travel: 'Personal Travel',
  sabbatical_leave: 'Sabbatical Leave',
  study_leave_extension: 'Study Leave Extension',
  local_travel: 'Local Travel (w/ Funding)',
}

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'In Progress',
  complete: 'Ready to Submit',
  submitted: 'Under HR Screening',
  returned_for_correction: 'Action Needed',
  approved: 'Approved',
}

function typeLabel(type: string) {
  return REQUEST_TYPE_LABELS[type] ?? type
}
function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}
function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// Requests needing employee action float to the top.
const sortedSubmissions = computed(() => {
  const priority: Record<string, number> = {
    returned_for_correction: 0,
    in_progress: 1,
    complete: 1,
    submitted: 2,
    approved: 3,
  }
  return [...submissions.value].sort((a, b) => {
    const pa = priority[a.status] ?? 9
    const pb = priority[b.status] ?? 9
    if (pa !== pb) return pa - pb
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  })
})

async function loadRequests() {
  loading.value = true
  loadError.value = ''
  try {
    submissions.value = await listMySubmissions()
  } catch (e) {
    loadError.value = 'Could not load your requests. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(loadRequests)
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="topbar-left">
        <NuxtLink to="/" class="app-icon" aria-label="Back to new request">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path d="M8 5l8 7-8 7" stroke="#003300" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </NuxtLink>
        <span class="app-title">CARSU · My Requests</span>
      </div>
      <div class="topbar-right">
        <NuxtLink to="/" class="new-link">+ New Request</NuxtLink>
        <span v-if="user" class="session-email">{{ user.email }}</span>
        <button class="logout-btn" @click="logout(); router.push('/login')">Log out</button>
      </div>
    </header>

    <main class="body">
      <p v-if="loadError" class="item-error">{{ loadError }}</p>

      <section v-if="loading" class="card">
        <div class="section-body">
          <p class="muted">Loading your requests…</p>
        </div>
      </section>

      <section v-else class="card">
        <div v-if="submissions.length === 0" class="section-body">
          <p class="muted">No requests found for this email.</p>
        </div>
        <table v-else class="req-table">
          <thead>
            <tr>
              <th>Request Type</th>
              <th>Created</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sortedSubmissions" :key="s.id" :class="{ 'row-attention': s.status === 'returned_for_correction' }">
              <td>{{ typeLabel(s.requestType) }}</td>
              <td>{{ formatDate(s.createdAt ?? s.submittedAt) }}</td>
              <td>
                <span class="status-pill" :class="`pill-${s.status}`">{{ statusLabel(s.status) }}</span>
              </td>
              <td>
                <NuxtLink :to="`/submit/${s.id}`" class="view-link">
                  {{ s.status === 'returned_for_correction' ? 'Fix Now →' : 'View →' }}
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>

    <footer class="footer">
      <span>© 2026 - CARSU HRMS</span>
      <span class="footer-links">Requirements Checklist</span>
    </footer>
  </div>
</template>

<style scoped>
.shell {
  --primary-green: #009900;
  --emerald: #003300;
  --gold: #f9dc07;
  --orange: #ff9900;
  --gray: #4d4d4d;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  font-family: 'Inter', system-ui, sans-serif;
}
.topbar {
  background: var(--emerald);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
}
.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.app-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.app-icon:hover {
  opacity: 0.85;
}
.app-title {
  font-size: 15.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.new-link {
  color: #fff;
  background: var(--primary-green);
  padding: 8px 14px;
  border-radius: 6px;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.session-email {
  font-size: 12.5px;
  opacity: 0.85;
  white-space: nowrap;
}
.logout-btn {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: #fff;
  padding: 7px 12px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.logout-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.body {
  flex: 1;
  padding: 28px 32px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
}
.card {
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e5e5e5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}
.section-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.field-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.field {
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--gray);
  font-weight: 600;
}
.field input {
  border: 1px solid #dcdcdc;
  border-radius: 4px;
  padding: 9px 11px;
  font-size: 14px;
  font-family: inherit;
}
.field input:focus {
  outline: 2px solid var(--primary-green);
  outline-offset: 1px;
}
.lookup-btn {
  background: var(--primary-green);
  color: #fff;
  border: none;
  padding: 10px 18px;
  border-radius: 4px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.lookup-btn:hover:not(:disabled) {
  background: var(--emerald);
}
.lookup-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.muted {
  color: var(--gray);
  font-size: 13.5px;
}
.item-error {
  margin: 0;
  font-size: 12.5px;
  color: #c0392b;
}

.req-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.req-table th {
  text-align: left;
  padding: 10px 20px;
  border-bottom: 2px solid #e5e5e5;
  color: var(--gray);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.req-table td {
  padding: 12px 20px;
  border-bottom: 1px solid #eee;
  vertical-align: middle;
}
.row-attention {
  background: #fdf6f6;
}
.status-pill {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 11.5px;
  font-weight: 700;
}
.pill-in_progress {
  background: #eee;
  color: var(--gray);
}
.pill-complete {
  background: #eaf3ff;
  color: #1a5fb4;
}
.pill-submitted {
  background: #fff4d6;
  color: #8a6300;
}
.pill-returned_for_correction {
  background: #fde3e3;
  color: #b00020;
}
.pill-approved {
  background: #dff5df;
  color: var(--emerald);
}
.view-link {
  color: var(--primary-green);
  font-weight: 600;
  text-decoration: none;
  font-size: 13px;
}
.view-link:hover {
  text-decoration: underline;
}

.footer {
  background: var(--orange);
  color: #1a1a1a;
  padding: 10px 28px;
  display: flex;
  justify-content: space-between;
  font-size: 12.5px;
  font-weight: 600;
}
</style>