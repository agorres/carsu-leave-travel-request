<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useChecklist, type SubmissionProgress } from '~/composables/useChecklist'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ middleware: 'admin-council' })

const route = useRoute()
const id = route.params.id as string
const router = useRouter()

const { getProgress, getDocumentDownloadUrl, getReferenceSlipDownloadUrl, getCertificationDownloadUrl, adminCouncilEndorse } = useChecklist()
const { user, logout } = useAuth()

const progress = ref<SubmissionProgress | null>(null)
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
  for_admin_council: 'For Endorsement',
  for_president_approval: 'Endorsed — With President',
  president_approved: 'Approved by President',
  for_board_confirmation: 'Approved — With Board',
  board_confirmed: 'Confirmed by Board',
  for_president_endorsement: 'Endorsed — With President',
  for_board_approval: 'With Board',
  board_approved: 'Approved by Board',
}

const typeLabel = computed(() => {
  const type = progress.value?.submission.requestType ?? ''
  return REQUEST_TYPE_LABELS[type] ?? type
})

const statusLabel = computed(() => STATUS_LABELS[progress.value?.submission.status ?? ''] ?? '')
const isForAdminCouncil = computed(() => progress.value?.submission.status === 'for_admin_council')
const isPastAdminCouncil = computed(() => {
  const s = progress.value?.submission.status
  return s === 'for_president_approval' || s === 'president_approved' || s === 'for_board_confirmation' || s === 'board_confirmed' ||
    s === 'for_president_endorsement' || s === 'for_board_approval' || s === 'board_approved'
})

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function docFor(itemCode: string) {
  return progress.value?.submission.documents.find((d) => d.itemCode === itemCode)
}

const endorsing = ref(false)
const endorseError = ref('')
const certificationFile = ref<File | null>(null)
function onCertificationFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  certificationFile.value = target.files?.[0] ?? null
}
async function onEndorse() {
  if (!certificationFile.value) {
    endorseError.value = 'Please attach the certification file before endorsing.'
    return
  }
  endorsing.value = true
  endorseError.value = ''
  try {
    const updated = await adminCouncilEndorse(id, certificationFile.value)
    if (progress.value) progress.value.submission = { ...progress.value.submission, ...updated }
    certificationFile.value = null
  } catch (e: any) {
    endorseError.value = e?.data?.message || 'Could not record the Admin Council endorsement.'
  } finally {
    endorsing.value = false
  }
}

onMounted(async () => {
  try {
    progress.value = await getProgress(id)
  } catch (e) {
    loadError.value = 'This request could not be found.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="admin-shell">
    <header class="admin-topbar">
      <div class="admin-title">Admin Council — Request Detail</div>
      <div class="admin-topbar-right">
        <NuxtLink to="/admin-council" class="link-back">← All Requests</NuxtLink>
        <span v-if="user" class="session-email">{{ user.email }}</span>
        <button class="logout-btn" @click="logout(); router.push('/login')">Log out</button>
      </div>
    </header>

    <main class="admin-body">
      <div v-if="loading" class="admin-card">
        <p class="muted">Loading request…</p>
      </div>

      <div v-else-if="loadError" class="admin-card">
        <p class="error-text">{{ loadError }}</p>
      </div>

      <template v-else-if="progress">
        <section class="admin-card status-card" :class="`status-${progress.submission.status}`">
          <div class="status-row">
            <span class="status-badge" :class="`badge-${progress.submission.status}`">{{ statusLabel }}</span>
            <span class="muted">Approved by ULDC {{ formatDateTime(progress.submission.uldcApprovedAt) }}</span>
            <span v-if="isPastAdminCouncil" class="muted">Endorsed by Admin Council {{ formatDateTime(progress.submission.adminCouncilEndorsedAt) }}</span>
          </div>
          <div v-if="progress.submission.referenceSlipOriginalFileName || progress.submission.certificationOriginalFileName" class="status-row">
            <a
              v-if="progress.submission.referenceSlipOriginalFileName"
              :href="getReferenceSlipDownloadUrl(progress.submission.id)"
              class="view-link"
              target="_blank"
              rel="noopener"
            >
              View Reference Slip →
            </a>
            <a
              v-if="progress.submission.certificationOriginalFileName"
              :href="getCertificationDownloadUrl(progress.submission.id)"
              class="view-link"
              target="_blank"
              rel="noopener"
            >
              View Certification →
            </a>
          </div>
        </section>

        <section class="admin-card">
          <h2 class="section-heading">Personal Information</h2>
          <div class="info-grid">
            <div class="info-field">
              <span class="info-label">Full Name</span>
              <span class="info-value">{{ progress.submission.employeeName }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">Email</span>
              <span class="info-value">{{ progress.submission.employeeEmail }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">Office Affiliation</span>
              <span class="info-value">{{ progress.submission.officeAffiliation }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">College / Office / Unit</span>
              <span class="info-value">{{ progress.submission.collegeOfficeUnit }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">Current Position</span>
              <span class="info-value">{{ progress.submission.currentPosition }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">Request Type</span>
              <span class="info-value">{{ typeLabel }} — {{ progress.submission.isImp ? 'IMP' : 'non-IMP' }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">Inclusive Dates</span>
              <span class="info-value">{{ formatDate(progress.submission.inclusiveDateFrom) }} — {{ formatDate(progress.submission.inclusiveDateTo) }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">Years in Position / CSU</span>
              <span class="info-value">{{ progress.submission.yearsInPosition }} / {{ progress.submission.yearsInCsu }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">Submitted</span>
              <span class="info-value">{{ formatDateTime(progress.submission.submittedAt) }}</span>
            </div>
          </div>
        </section>

        <section class="admin-card">
          <h2 class="section-heading">Documents ({{ progress.totalUploaded }}/{{ progress.totalRequired }})</h2>
          <table class="admin-table">
            <thead>
              <tr>
                <th>Requirement</th>
                <th>File</th>
                <th>ULDC Review</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in progress.requiredItems" :key="item.code">
                <td>
                  <div class="employee-name">{{ item.label }}</div>
                  <div v-if="item.note" class="muted">{{ item.note }}</div>
                </td>
                <td>
                  <span v-if="docFor(item.code)?.isNotApplicable" class="muted na-text">Marked Not Applicable</span>
                  <span v-else-if="docFor(item.code)">{{ docFor(item.code)!.originalFileName }}</span>
                  <span v-else class="error-text">Not provided</span>
                  <div>
                    <a
                      v-if="docFor(item.code) && !docFor(item.code)!.isNotApplicable"
                      :href="getDocumentDownloadUrl(progress.submission.id, item.code)"
                      class="view-link"
                      target="_blank"
                      rel="noopener"
                    >
                      View File →
                    </a>
                  </div>
                </td>
                <td>
                  <span
                    v-if="docFor(item.code)"
                    class="review-badge"
                    :class="`review-${docFor(item.code)!.reviewStatus}`"
                  >
                    {{ docFor(item.code)!.reviewStatus }}
                  </span>
                  <span v-else class="muted">—</span>
                  <div v-if="docFor(item.code)?.reviewComment" class="review-comment">
                    “{{ docFor(item.code)!.reviewComment }}”
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="admin-card">
          <div v-if="isForAdminCouncil" class="screening-actions">
            <p class="muted">ULDC has forwarded this Foreign Travel request. Review the documents above, attach the certification, then endorse it to continue the approval flow.</p>
            <div class="action-buttons">
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" @change="onCertificationFileChange" />
              <button class="action-btn primary" :disabled="endorsing" @click="onEndorse">
                {{ endorsing ? 'Endorsing…' : 'Endorse Request' }}
              </button>
            </div>
            <p v-if="endorseError" class="item-error">{{ endorseError }}</p>
          </div>

          <div v-else-if="isPastAdminCouncil" class="screening-actions">
            <p class="muted">This request has moved past Admin Council and is now {{ statusLabel.toLowerCase() }} — no further action needed here.</p>
          </div>
        </section>
      </template>
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
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.link-back:hover {
  text-decoration: underline;
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
  max-width: 900px;
  margin: 28px auto;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.admin-card {
  background: #fff;
  border: 1px solid #dcdcdc;
  border-radius: 8px;
  padding: 20px;
}
.section-heading {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 700;
  color: var(--emerald);
}
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.info-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.info-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--gray);
  font-weight: 600;
}
.info-value {
  font-size: 14px;
  color: #1a1a1a;
}
.muted {
  color: var(--gray);
  font-size: 13.5px;
}
.error-text {
  color: #b00020;
  font-size: 13.5px;
}
.na-text {
  font-style: italic;
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
.view-link {
  color: var(--primary-green);
  font-weight: 600;
  text-decoration: none;
  font-size: 13px;
}
.view-link:hover {
  text-decoration: underline;
}
.status-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.status-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.status-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.badge-for_president_reference {
  background: #fff4d6;
  color: #8a6300;
}
.badge-for_admin_council {
  background: #f1e8fd;
  color: #5a2ca0;
}
.badge-for_board_confirmation {
  background: #eaf3ff;
  color: #1a5fb4;
}
.badge-for_president_approval,
.badge-for_president_endorsement {
  background: #fde9d7;
  color: #a05a1a;
}
.badge-for_board_approval {
  background: #eaf3ff;
  color: #1a5fb4;
}
.badge-president_approved,
.badge-board_confirmed,
.badge-board_approved {
  background: #dff5df;
  color: var(--emerald);
}
.screening-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.action-btn {
  border: none;
  padding: 10px 18px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.action-btn.primary {
  background: var(--primary-green);
  color: #fff;
}
.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.item-error {
  color: #b00020;
  font-size: 12.5px;
}
.review-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: capitalize;
}
.review-pending {
  background: #eee;
  color: var(--gray);
}
.review-approved {
  background: #dff5df;
  color: var(--emerald);
}
.review-rejected {
  background: #fde3e3;
  color: #b00020;
}
.review-comment {
  margin-top: 4px;
  font-size: 12px;
  color: var(--gray);
  font-style: italic;
  max-width: 220px;
}
</style>