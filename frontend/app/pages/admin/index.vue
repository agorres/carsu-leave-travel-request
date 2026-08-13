<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useChecklist, type Submission } from '~/composables/useChecklist'

const { listSubmittedSubmissions } = useChecklist()

const submissions = ref<Submission[]>([])
const loading = ref(true)
const loadError = ref('')

const REQUEST_TYPE_LABELS: Record<string, string> = {
  study_leave: 'Study Leave',
  foreign_travel: 'Foreign Travel',
  personal_travel: 'Personal Travel',
  sabbatical_leave: 'Sabbatical Leave',
  study_leave_extension: 'Study Leave Extension',
}

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Under Screening',
  returned_for_correction: 'Returned for Correction',
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

onMounted(async () => {
  try {
    submissions.value = await listSubmittedSubmissions()
  } catch (e) {
    loadError.value = 'Could not load submitted requests. Is the server running?'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="admin-shell">
    <header class="admin-topbar">
      <div class="admin-title">HRMS — Submitted Requests</div>
      <NuxtLink to="/" class="link-back">+ New Request</NuxtLink>
    </header>

    <main class="admin-body">
      <div v-if="loading" class="admin-card">
        <p class="muted">Loading submitted requests…</p>
      </div>

      <div v-else-if="loadError" class="admin-card">
        <p class="error-text">{{ loadError }}</p>
      </div>

      <div v-else-if="submissions.length === 0" class="admin-card">
        <p class="muted">No requests have been submitted yet.</p>
      </div>

      <div v-else class="admin-card">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Office / Unit</th>
              <th>Request Type</th>
              <th>Submitted</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in submissions" :key="s.id">
              <td>
                <div class="employee-name">{{ s.employeeName }}</div>
                <div class="employee-email">{{ s.employeeEmail }}</div>
              </td>
              <td>
                <div>{{ s.officeAffiliation }}</div>
                <div class="muted">{{ s.collegeOfficeUnit }}</div>
              </td>
              <td>{{ typeLabel(s.requestType) }}</td>
              <td>{{ formatDate(s.submittedAt) }}</td>
              <td>
                <span class="status-pill" :class="`pill-${s.status}`">{{ statusLabel(s.status) }}</span>
              </td>
              <td>
                <NuxtLink :to="`/admin/${s.id}`" class="view-link">View →</NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-shell {
  --primary-green: #009900;
  --emerald: #003300;
  --gray: #4d4d4d;
  min-height: 100vh;
  background: #f5f6f5;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 28px;
  background: var(--emerald);
  color: #fff;
}
.admin-title {
  font-size: 16px;
  font-weight: 700;
}
.link-back {
  color: #fff;
  background: var(--primary-green);
  padding: 8px 14px;
  border-radius: 6px;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}
.admin-body {
  max-width: 1000px;
  margin: 28px auto;
  padding: 0 20px;
}
.admin-card {
  background: #fff;
  border: 1px solid #dcdcdc;
  border-radius: 8px;
  padding: 20px;
}
.muted {
  color: var(--gray);
  font-size: 13.5px;
}
.error-text {
  color: #b00020;
  font-size: 13.5px;
}
.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.admin-table th {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 2px solid #e5e5e5;
  color: var(--gray);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.admin-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
  vertical-align: top;
}
.employee-name {
  font-weight: 600;
  color: #1a1a1a;
}
.employee-email {
  color: var(--gray);
  font-size: 12.5px;
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
.status-pill {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 11.5px;
  font-weight: 700;
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
</style>
