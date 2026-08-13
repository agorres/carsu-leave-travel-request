<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useChecklist, type SubmissionProgress } from '~/composables/useChecklist'

const route = useRoute()
const id = route.params.id as string

const { getProgress, getDocumentDownloadUrl, reviewDocument, returnForCorrection, approveSubmission } = useChecklist()

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
  in_progress: 'In Progress',
  complete: 'Ready to Submit',
  submitted: 'Under HR Screening',
  returned_for_correction: 'Returned for Correction',
  approved: 'Approved',
}

const typeLabel = computed(() => {
  const type = progress.value?.submission.requestType ?? ''
  return REQUEST_TYPE_LABELS[type] ?? type
})

const statusLabel = computed(() => STATUS_LABELS[progress.value?.submission.status ?? ''] ?? '')
const isUnderScreening = computed(() => progress.value?.submission.status === 'submitted')
const isReturned = computed(() => progress.value?.submission.status === 'returned_for_correction')
const isApproved = computed(() => progress.value?.submission.status === 'approved')

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

// --- per-document review drafts ---
const commentDrafts = reactive<Record<string, string>>({})
const reviewingCode = ref<string | null>(null)
const reviewErrorByCode = reactive<Record<string, string>>({})

const hasAnyRejected = computed(() =>
  progress.value?.submission.documents.some((d) => d.reviewStatus === 'rejected') ?? false
)
const allApproved = computed(() => {
  if (!progress.value) return false
  return progress.value.requiredItems.every((item) => docFor(item.code)?.reviewStatus === 'approved')
})

async function approveDoc(itemCode: string) {
  reviewingCode.value = itemCode
  reviewErrorByCode[itemCode] = ''
  try {
    const updated = await reviewDocument(id, itemCode, 'approved', commentDrafts[itemCode]?.trim() || undefined)
    applyReviewedDoc(itemCode, updated)
  } catch (e: any) {
    reviewErrorByCode[itemCode] = e?.data?.message || 'Could not approve this document.'
  } finally {
    reviewingCode.value = null
  }
}

async function rejectDoc(itemCode: string) {
  const comment = (commentDrafts[itemCode] ?? '').trim()
  if (!comment) {
    reviewErrorByCode[itemCode] = 'Add a comment explaining what needs to be fixed.'
    return
  }
  reviewingCode.value = itemCode
  reviewErrorByCode[itemCode] = ''
  try {
    const updated = await reviewDocument(id, itemCode, 'rejected', comment)
    applyReviewedDoc(itemCode, updated)
  } catch (e: any) {
    reviewErrorByCode[itemCode] = e?.data?.message || 'Could not reject this document.'
  } finally {
    reviewingCode.value = null
  }
}

function applyReviewedDoc(itemCode: string, updated: any) {
  if (!progress.value) return
  const docs = progress.value.submission.documents.filter((d) => d.itemCode !== itemCode)
  docs.push(updated)
  progress.value.submission.documents = docs
  commentDrafts[itemCode] = ''
}

// --- top-level actions ---
const sendingBack = ref(false)
const sendBackError = ref('')
async function onSendBack() {
  sendingBack.value = true
  sendBackError.value = ''
  try {
    const updated = await returnForCorrection(id)
    if (progress.value) progress.value.submission = { ...progress.value.submission, ...updated }
  } catch (e: any) {
    sendBackError.value = e?.data?.message || 'Could not send this request back.'
  } finally {
    sendingBack.value = false
  }
}

const approving = ref(false)
const approveError = ref('')
async function onApprove() {
  approving.value = true
  approveError.value = ''
  try {
    const updated = await approveSubmission(id)
    if (progress.value) progress.value.submission = { ...progress.value.submission, ...updated }
  } catch (e: any) {
    approveError.value = e?.data?.message || 'Could not approve this request.'
  } finally {
    approving.value = false
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
      <div class="admin-title">HRMS — Request Detail</div>
      <NuxtLink to="/admin" class="link-back">← All Requests</NuxtLink>
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
            <span v-if="isReturned" class="muted">Sent back {{ formatDateTime(progress.submission.returnedAt) }}</span>
            <span v-if="isApproved" class="muted">Approved {{ formatDateTime(progress.submission.approvedAt) }}</span>
          </div>

          <div v-if="isUnderScreening" class="screening-actions">
            <p class="muted">Approve or reject each document below, then either send the request back for correction or, once every document is approved, approve the whole request.</p>
            <div class="action-buttons">
              <button class="action-btn danger" :disabled="!hasAnyRejected || sendingBack" @click="onSendBack">
                {{ sendingBack ? 'Sending back…' : 'Send Back for Correction' }}
              </button>
              <button class="action-btn primary" :disabled="!allApproved || approving" @click="onApprove">
                {{ approving ? 'Approving…' : 'Approve Request' }}
              </button>
            </div>
            <p v-if="sendBackError" class="item-error">{{ sendBackError }}</p>
            <p v-if="approveError" class="item-error">{{ approveError }}</p>
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
              <span class="info-value">{{ typeLabel }}</span>
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
              <span class="info-value">{{ formatDate(progress.submission.submittedAt) }}</span>
            </div>
          </div>
        </section>

        <section class="admin-card">
          <h2 class="section-heading">Submitted Documents ({{ progress.totalUploaded }}/{{ progress.totalRequired }})</h2>
          <table class="admin-table">
            <thead>
              <tr>
                <th>Requirement</th>
                <th>File</th>
                <th>Status</th>
                <th v-if="isUnderScreening">Review</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in progress.requiredItems" :key="item.code">
                <td>
                  <div class="employee-name">{{ item.label }}</div>
                  <div v-if="item.note" class="muted">{{ item.note }}</div>
                </td>
                <td>
                  <span v-if="docFor(item.code)">{{ docFor(item.code)!.originalFileName }}</span>
                  <span v-else class="error-text">Not provided</span>
                  <div>
                    <a
                      v-if="docFor(item.code)"
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
                <td v-if="isUnderScreening" class="review-cell">
                  <template v-if="docFor(item.code)">
                    <textarea
                      v-model="commentDrafts[item.code]"
                      class="review-textarea"
                      placeholder="Comment (required to reject)"
                      rows="2"
                    />
                    <div class="review-buttons">
                      <button
                        class="review-btn approve"
                        :disabled="reviewingCode === item.code"
                        @click="approveDoc(item.code)"
                      >
                        Approve
                      </button>
                      <button
                        class="review-btn reject"
                        :disabled="reviewingCode === item.code"
                        @click="rejectDoc(item.code)"
                      >
                        Reject
                      </button>
                    </div>
                    <p v-if="reviewErrorByCode[item.code]" class="item-error">{{ reviewErrorByCode[item.code] }}</p>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
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
}
.link-back:hover {
  text-decoration: underline;
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
.badge-submitted {
  background: #fff4d6;
  color: #8a6300;
}
.badge-returned_for_correction {
  background: #fde3e3;
  color: #b00020;
}
.badge-approved {
  background: #dff5df;
  color: var(--emerald);
}
.screening-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
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
.action-btn.danger {
  background: #fff;
  border: 1.5px solid #b00020;
  color: #b00020;
}
.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
.review-cell {
  min-width: 220px;
}
.review-textarea {
  width: 100%;
  border: 1px solid #dcdcdc;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12.5px;
  font-family: inherit;
  resize: vertical;
}
.review-buttons {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.review-btn {
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.review-btn.approve {
  background: var(--primary-green);
  color: #fff;
}
.review-btn.reject {
  background: #fff;
  border: 1px solid #b00020;
  color: #b00020;
}
.review-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
