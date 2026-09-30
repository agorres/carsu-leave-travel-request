<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useChecklist, type Submission } from '~/composables/useChecklist'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ middleware: 'uldc-committee' })

const { listAllSubmissionsForMonitoring } = useChecklist()
const { user, logout } = useAuth()
const router = useRouter()

const submissions = ref<Submission[]>([])
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const statusFilter = ref('')

const REQUEST_TYPE_LABELS: Record<string, string> = {
  study_leave: 'Study Leave',
  foreign_travel: 'Foreign Travel',
  personal_travel: 'Personal Travel',
  sabbatical_leave: 'Sabbatical Leave',
  study_leave_extension: 'Study Leave Extension',
  local_travel: 'Local Travel (w/ Funding)',
}

// Every status the system can produce, so this view never shows a raw
// status string for a request that hasn't reached ULDC Committee yet.
const STATUS_LABELS: Record<string, string> = {
  in_progress: 'In Progress (Not Submitted)',
  complete: 'Ready to Submit',
  submitted: 'Under Sub-Committee Screening',
  returned_for_correction: 'Returned for Correction',
  for_board_deliberation: 'For Board Deliberation',
  uldc_deliberation: 'Under Committee Deliberation',
  for_president_reference: 'For President\'s Reference',
  for_admin_council: 'For Admin Council',
  for_president_approval: 'For President Approval',
  president_approved: 'Approved by President',
  for_board_confirmation: 'For Board Confirmation',
  board_confirmed: 'Confirmed by Board',
  for_president_endorsement: 'For President Endorsement',
  for_board_approval: 'For Board Approval',
  board_approved: 'Approved by Board',
}

const STATUS_FILTER_OPTIONS = Object.entries(STATUS_LABELS)

// Buckets every raw status into one of four high-level stages, for the
// summary cards and the donut chart. Purely a display grouping — doesn't
// affect the status filter dropdown above, which still lists every exact
// status.
const STATUS_BUCKETS: Record<string, 'draft' | 'review' | 'returned' | 'approved'> = {
  in_progress: 'draft',
  complete: 'draft',
  submitted: 'review',
  returned_for_correction: 'returned',
  for_board_deliberation: 'review',
  uldc_deliberation: 'review',
  for_president_reference: 'review',
  for_admin_council: 'review',
  for_president_approval: 'review',
  president_approved: 'review',
  for_board_confirmation: 'review',
  board_confirmed: 'approved',
  for_president_endorsement: 'review',
  for_board_approval: 'review',
  board_approved: 'approved',
}
const BUCKET_ORDER = ['draft', 'review', 'returned', 'approved'] as const
const BUCKET_LABELS: Record<string, string> = {
  draft: 'Draft (Not Submitted)',
  review: 'Under Review',
  returned: 'Returned for Correction',
  approved: 'Approved (Final)',
}
const BUCKET_COLORS: Record<string, string> = {
  draft: '#9ca3af',
  review: '#f5a623',
  returned: '#e05252',
  approved: '#2f9e44',
}

function typeLabel(type: string) {
  return REQUEST_TYPE_LABELS[type] ?? type
}
function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}
function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Every stat below is computed off the full, unfiltered submissions list —
// the search box and status dropdown only narrow the table underneath.
const bucketCounts = computed(() => {
  const counts: Record<string, number> = { draft: 0, review: 0, returned: 0, approved: 0 }
  for (const s of submissions.value) {
    const bucket = STATUS_BUCKETS[s.status] ?? 'review'
    counts[bucket]++
  }
  return counts
})

const totalCount = computed(() => submissions.value.length)

const donutSlices = computed(() => {
  const total = totalCount.value || 1
  let cumulative = 0
  return BUCKET_ORDER.map((bucket) => {
    const count = bucketCounts.value[bucket] ?? 0
    const start = (cumulative / total) * 360
    cumulative += count
    const end = (cumulative / total) * 360
    return { bucket, count, start, end }
  }).filter((slice) => slice.count > 0)
})

const donutGradient = computed(() => {
  if (donutSlices.value.length === 0) return '#eee 0deg 360deg'
  return donutSlices.value.map((s) => `${BUCKET_COLORS[s.bucket]} ${s.start}deg ${s.end}deg`).join(', ')
})

const typeCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const type of Object.keys(REQUEST_TYPE_LABELS)) counts[type] = 0
  for (const s of submissions.value) {
    counts[s.requestType] = (counts[s.requestType] ?? 0) + 1
  }
  return counts
})
const maxTypeCount = computed(() => Math.max(1, ...Object.values(typeCounts.value)))
const requestTypeEntries = Object.entries(REQUEST_TYPE_LABELS)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return submissions.value.filter((s) => {
    if (statusFilter.value && s.status !== statusFilter.value) return false
    if (!q) return true
    return (
      s.employeeName?.toLowerCase().includes(q) ||
      s.employeeEmail?.toLowerCase().includes(q) ||
      s.applicationNumber?.toLowerCase().includes(q)
    )
  })
})

onMounted(async () => {
  try {
    submissions.value = await listAllSubmissionsForMonitoring()
  } catch (e) {
    loadError.value = 'Could not load requests. Is the server running?'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="admin-shell">
    <header class="admin-topbar">
      <div class="admin-title">ULDC Committee — All Requests (Monitoring)</div>
      <div class="admin-topbar-right">
        <NuxtLink to="/uldc-committee" class="monitoring-link">Back to Requests</NuxtLink>
        <span v-if="user" class="session-email">{{ user.email }}</span>
        <button class="logout-btn" @click="logout(); router.push('/login')">Log out</button>
      </div>
    </header>

    <main class="admin-body">
      <div v-if="!loading && !loadError" class="stat-cards">
        <div class="stat-card">
          <span class="stat-value">{{ totalCount }}</span>
          <span class="stat-label">Total Requests</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" :style="{ color: BUCKET_COLORS.review }">{{ bucketCounts.review }}</span>
          <span class="stat-label">Under Review</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" :style="{ color: BUCKET_COLORS.returned }">{{ bucketCounts.returned }}</span>
          <span class="stat-label">Returned for Correction</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" :style="{ color: BUCKET_COLORS.approved }">{{ bucketCounts.approved }}</span>
          <span class="stat-label">Approved (Final)</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" :style="{ color: BUCKET_COLORS.draft }">{{ bucketCounts.draft }}</span>
          <span class="stat-label">Draft (Not Submitted)</span>
        </div>
      </div>

      <div v-if="!loading && !loadError && totalCount > 0" class="charts-row">
        <div class="chart-card">
          <div class="chart-title">By Stage</div>
          <div class="donut-wrap">
            <div class="donut" :style="{ background: `conic-gradient(${donutGradient})` }">
              <div class="donut-hole">
                <span class="donut-total">{{ totalCount }}</span>
                <span class="donut-total-label">total</span>
              </div>
            </div>
            <ul class="legend">
              <li v-for="bucket in BUCKET_ORDER" :key="bucket">
                <span class="legend-swatch" :style="{ background: BUCKET_COLORS[bucket] }"></span>
                {{ BUCKET_LABELS[bucket] }} — {{ bucketCounts[bucket] }}
              </li>
            </ul>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-title">By Request Type</div>
          <div class="bar-chart">
            <div v-for="[type, label] in requestTypeEntries" :key="type" class="bar-row">
              <span class="bar-label">{{ label }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: (typeCounts[type] / maxTypeCount * 100) + '%' }"></div>
              </div>
              <span class="bar-count">{{ typeCounts[type] }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="monitoring-toolbar">
        <div class="monitoring-filters">
          <input v-model="search" class="search-input" type="text" placeholder="Search name, email, or application no." />
          <select v-model="statusFilter" class="status-select">
            <option value="">All statuses</option>
            <option v-for="[value, label] in STATUS_FILTER_OPTIONS" :key="value" :value="value">{{ label }}</option>
          </select>
        </div>
      </div>

      <p class="monitoring-note">Read-only — every request in the system, regardless of stage. Actions are still only available from the Requests page.</p>

      <div v-if="loading" class="admin-card">
        <p class="muted">Loading requests…</p>
      </div>

      <div v-else-if="loadError" class="admin-card">
        <p class="error-text">{{ loadError }}</p>
      </div>

      <div v-else-if="filtered.length === 0" class="admin-card">
        <p class="muted">No requests match your search/filter.</p>
      </div>

      <div v-else class="admin-card">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Application No.</th>
              <th>Employee</th>
              <th>Office / Unit</th>
              <th>Request Type</th>
              <th>Submitted</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in filtered" :key="s.id">
              <td class="app-number">{{ s.applicationNumber ?? '—' }}</td>
              <td>
                <div class="employee-name">{{ s.employeeName }}</div>
                <div class="employee-email">{{ s.employeeEmail }}</div>
              </td>
              <td>
                <div>{{ s.officeAffiliation }}</div>
                <div class="muted">{{ s.collegeOfficeUnit }}</div>
              </td>
              <td>
                {{ typeLabel(s.requestType) }}
                <span class="imp-tag">{{ s.isImp ? 'IMP' : 'non-IMP' }}</span>
                <span v-if="s.travelPurpose" class="purpose-tag" :class="`purpose-${s.travelPurpose}`">{{ s.travelPurpose === 'official' ? 'Official' : 'Personal' }}</span>
              </td>
              <td>{{ formatDateTime(s.createdAt ?? s.submittedAt) }}</td>
              <td>
                <span class="status-pill" :class="`pill-${s.status}`">{{ statusLabel(s.status) }}</span>
              </td>
              <td>
                <NuxtLink :to="`/uldc-committee/${s.id}`" class="view-link">View →</NuxtLink>
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
.admin-topbar-right {
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
.admin-body {
  max-width: 1400px;
  margin: 28px auto;
  padding: 0 28px;
}
.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}
.stat-card {
  background: #fff;
  border: 1px solid #dcdcdc;
  border-radius: 8px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-value {
  font-size: 28px;
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1;
}
.stat-label {
  font-size: 12px;
  color: var(--gray);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.charts-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}
.chart-card {
  background: #fff;
  border: 1px solid #dcdcdc;
  border-radius: 8px;
  padding: 20px 24px;
}
.chart-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--gray);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-bottom: 16px;
}
.donut-wrap {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}
.donut {
  position: relative;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  flex-shrink: 0;
}
.donut-hole {
  position: absolute;
  inset: 22px;
  background: #fff;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.donut-total {
  font-size: 22px;
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1;
}
.donut-total-label {
  font-size: 10.5px;
  color: var(--gray);
  text-transform: uppercase;
}
.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: #1a1a1a;
}
.legend-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 8px;
}
.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bar-row {
  display: grid;
  grid-template-columns: 150px 1fr 28px;
  align-items: center;
  gap: 10px;
}
.bar-label {
  font-size: 12.5px;
  color: var(--gray);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar-track {
  background: #f0f0f0;
  border-radius: 4px;
  height: 14px;
  overflow: hidden;
}
.bar-fill {
  background: var(--primary-green);
  height: 100%;
  border-radius: 4px;
  transition: width 0.2s ease;
}
.bar-count {
  font-size: 12.5px;
  font-weight: 700;
  color: #1a1a1a;
  text-align: right;
}
.monitoring-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
}
.monitoring-link {
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.4);
  padding: 7px 12px;
  border-radius: 6px;
  white-space: nowrap;
}
.monitoring-link:hover {
  background: rgba(255, 255, 255, 0.12);
}
.monitoring-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.search-input {
  padding: 8px 12px;
  border: 1px solid #dcdcdc;
  border-radius: 6px;
  font-size: 13px;
  min-width: 260px;
}
.status-select {
  padding: 8px 12px;
  border: 1px solid #dcdcdc;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}
.monitoring-note {
  color: var(--gray);
  font-size: 12.5px;
  margin: 0 0 16px;
}
.admin-card {
  background: #fff;
  border: 1px solid #dcdcdc;
  border-radius: 8px;
  padding: 28px;
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
  padding: 14px 18px;
  border-bottom: 2px solid #e5e5e5;
  color: var(--gray);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.admin-table td {
  padding: 16px 18px;
  border-bottom: 1px solid #eee;
  vertical-align: top;
}
.app-number {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  color: var(--gray);
  white-space: nowrap;
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
  white-space: nowrap;
}
.pill-in_progress,
.pill-complete {
  background: #eee;
  color: var(--gray);
}
.pill-submitted,
.pill-uldc_deliberation,
.pill-for_president_reference {
  background: #fff4d6;
  color: #8a6300;
}
.pill-returned_for_correction {
  background: #fde2e1;
  color: #b42318;
}
.pill-for_board_deliberation,
.pill-for_admin_council {
  background: #f1e8fd;
  color: #5a2ca0;
}
.pill-for_board_confirmation,
.pill-for_board_approval {
  background: #eaf3ff;
  color: #1a5fb4;
}
.pill-for_president_approval,
.pill-for_president_endorsement {
  background: #fde9d7;
  color: #a05a1a;
}
.pill-president_approved,
.pill-board_confirmed,
.pill-board_approved {
  background: #dff5df;
  color: var(--emerald);
}
.imp-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
  background: #f1e8fd;
  color: #5a2ca0;
}
.purpose-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
}
.purpose-official {
  background: #eaf3ff;
  color: #1a5fb4;
}
.purpose-personal {
  background: #fdf1e0;
  color: #a05a1a;
}
</style>