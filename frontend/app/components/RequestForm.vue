<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useChecklist, type RequestTypeOption, type SubmissionProgress, type SubmissionDocument } from '~/composables/useChecklist'

const props = defineProps<{ initialSubmissionId?: string }>()

const router = useRouter()
const { listRequestTypes, createSubmission, getProgress, uploadDocument, removeDocument, submitSubmission } = useChecklist()

const types = ref<RequestTypeOption[]>([])
const loadingTypes = ref(true)
const loadingExisting = ref(!!props.initialSubmissionId)
const loadError = ref('')

const OFFICE_AFFILIATION_OPTIONS = ['OVPAA', 'OVPAF', 'OVPRDIE', 'OVPSAS']

const selectedType = ref<string>('')
const isAbroad = ref(false)
const employeeName = ref('')
const employeeUsername = ref('')
const officeAffiliation = ref('')
const collegeOfficeUnit = ref('')
const currentPosition = ref('')
const inclusiveDateFrom = ref('')
const inclusiveDateTo = ref('')
const yearsInPosition = ref<number | null>(null)
const yearsInCsu = ref<number | null>(null)

const employeeEmail = computed(() =>
  employeeUsername.value.trim() ? `${employeeUsername.value.trim()}@carsu.edu.ph` : ''
)

const ABROAD_ELIGIBLE = ['study_leave', 'foreign_travel']

const submissionId = ref<string | null>(null)
const progress = ref<SubmissionProgress | null>(null)
const creating = ref(false)
const uploadingCode = ref<string | null>(null)
const errorByCode = ref<Record<string, string>>({})

const infoComplete = computed(() => {
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employeeEmail.value.trim())
  return (
    !!selectedType.value &&
    employeeName.value.trim().length >= 2 &&
    emailValid &&
    officeAffiliation.value.trim().length >= 2 &&
    collegeOfficeUnit.value.trim().length >= 2 &&
    currentPosition.value.trim().length >= 2 &&
    !!inclusiveDateFrom.value &&
    !!inclusiveDateTo.value &&
    yearsInPosition.value !== null && yearsInPosition.value >= 0 &&
    yearsInCsu.value !== null && yearsInCsu.value >= 0
  )
})

const readyToSubmit = computed(() => progress.value?.submission.status === 'complete')
const isSubmitted = computed(() => progress.value?.submission.status === 'submitted')
const isReturned = computed(() => progress.value?.submission.status === 'returned_for_correction')
const isApproved = computed(() => progress.value?.submission.status === 'approved')
// Once returned, everything is locked EXCEPT items HR flagged rejected.
const canReupload = (itemCode: string) => isReturned.value && docFor(itemCode)?.reviewStatus === 'rejected'
const hasRejectedRemaining = computed(() =>
  progress.value?.submission.documents.some((d) => d.reviewStatus === 'rejected') ?? false
)
const readyToResubmit = computed(() => isReturned.value && !hasRejectedRemaining.value)
const submitting = ref(false)
const submitError = ref('')

onMounted(async () => {
  try {
    types.value = await listRequestTypes()
  } catch (e) {
    loadError.value = 'Could not load request types. Is the server running?'
  } finally {
    loadingTypes.value = false
  }

  if (props.initialSubmissionId) {
    try {
      progress.value = await getProgress(props.initialSubmissionId)
      submissionId.value = props.initialSubmissionId
      const s = progress.value.submission
      selectedType.value = s.requestType
      isAbroad.value = s.isAbroad
      employeeName.value = s.employeeName
      employeeUsername.value = s.employeeEmail.replace(/@carsu\.edu\.ph$/, '')
      officeAffiliation.value = s.officeAffiliation
      collegeOfficeUnit.value = s.collegeOfficeUnit
      currentPosition.value = s.currentPosition
      inclusiveDateFrom.value = s.inclusiveDateFrom
      inclusiveDateTo.value = s.inclusiveDateTo
      yearsInPosition.value = s.yearsInPosition
      yearsInCsu.value = s.yearsInCsu
    } catch (e) {
      loadError.value = 'This request could not be found. It may have been removed.'
    } finally {
      loadingExisting.value = false
    }
  }
})

async function beginChecklist() {
  if (!infoComplete.value) return
  creating.value = true
  try {
    const submission = await createSubmission({
      requestType: selectedType.value,
      isAbroad: isAbroad.value,
      employeeName: employeeName.value.trim(),
      employeeEmail: employeeEmail.value.trim(),
      officeAffiliation: officeAffiliation.value.trim(),
      collegeOfficeUnit: collegeOfficeUnit.value.trim(),
      currentPosition: currentPosition.value.trim(),
      inclusiveDateFrom: inclusiveDateFrom.value,
      inclusiveDateTo: inclusiveDateTo.value,
      yearsInPosition: yearsInPosition.value ?? 0,
      yearsInCsu: yearsInCsu.value ?? 0,
    })
    submissionId.value = submission.id
    if (import.meta.client) localStorage.setItem('carsu-checklist-employee-email', employeeEmail.value.trim())
    progress.value = await getProgress(submission.id)
    router.replace(`/submit/${submission.id}`)
  } finally {
    creating.value = false
  }
}

function recalculateProgress() {
  if (!progress.value) return
  const uploadedItemCodes = progress.value.submission.documents.map((d) => d.itemCode)
  const missingItems = progress.value.requiredItems.filter((i) => !uploadedItemCodes.includes(i.code))
  progress.value.uploadedItemCodes = uploadedItemCodes
  progress.value.missingItems = missingItems
  progress.value.totalUploaded = progress.value.totalRequired - missingItems.length
  progress.value.percentComplete = progress.value.totalRequired
    ? Math.round((progress.value.totalUploaded / progress.value.totalRequired) * 100)
    : 0
  const lockedStatuses = ['submitted', 'returned_for_correction', 'approved']
  if (!lockedStatuses.includes(progress.value.submission.status)) {
    progress.value.submission.status = missingItems.length === 0 ? 'complete' : 'in_progress'
  }
}

function applyUploadedDocument(itemCode: string, doc: SubmissionDocument) {
  if (!progress.value) return
  const docs = progress.value.submission.documents.filter((d) => d.itemCode !== itemCode)
  docs.push(doc)
  progress.value.submission.documents = docs
  recalculateProgress()
}

function removeLocalDocument(itemCode: string) {
  if (!progress.value) return
  progress.value.submission.documents = progress.value.submission.documents.filter((d) => d.itemCode !== itemCode)
  recalculateProgress()
}

async function onFileChange(itemCode: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !submissionId.value) return

  uploadingCode.value = itemCode
  errorByCode.value = { ...errorByCode.value, [itemCode]: '' }
  try {
    const uploaded = await uploadDocument(submissionId.value, itemCode, file)
    applyUploadedDocument(itemCode, uploaded)
  } catch (e: any) {
    errorByCode.value = { ...errorByCode.value, [itemCode]: e?.data?.message || 'Upload failed. Try again.' }
  } finally {
    uploadingCode.value = null
    input.value = ''
  }
}

async function onRemove(itemCode: string) {
  if (!submissionId.value) return
  await removeDocument(submissionId.value, itemCode)
  removeLocalDocument(itemCode)
}

async function submitRequest() {
  if (!submissionId.value || !readyToSubmit.value) return
  submitting.value = true
  submitError.value = ''
  try {
    const updated = await submitSubmission(submissionId.value)
    if (progress.value) progress.value.submission = updated
  } catch (e: any) {
    submitError.value = e?.data?.message || 'Submit failed. Try again.'
  } finally {
    submitting.value = false
  }
}

async function resubmitRequest() {
  if (!submissionId.value || !readyToResubmit.value) return
  submitting.value = true
  submitError.value = ''
  try {
    const updated = await submitSubmission(submissionId.value)
    if (progress.value) progress.value.submission = { ...progress.value.submission, ...updated }
  } catch (e: any) {
    submitError.value = e?.data?.message || 'Resubmit failed. Try again.'
  } finally {
    submitting.value = false
  }
}

function startNewRequest() {
  router.push('/')
}

function docFor(itemCode: string) {
  return progress.value?.submission.documents.find((d) => d.itemCode === itemCode)
}

function itemEditable(itemCode: string) {
  if (isSubmitted.value || isApproved.value) return false
  if (isReturned.value) return canReupload(itemCode)
  return true
}

const groupedItems = computed(() => {
  if (!progress.value) return []
  const items = progress.value.requiredItems
  const groups: { label: string | null; items: typeof items }[] = []
  for (const item of items) {
    const label = item.groupLabel ?? null
    let group = groups.find((g) => g.label === label)
    if (!group) {
      group = { label, items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
})
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="topbar-left">
        <div class="app-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path d="M8 5l8 7-8 7" stroke="#003300" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="app-title">CARSU · Leave &amp; Travel Requirements</span>
      </div>
      <NuxtLink to="/my-requests" class="my-requests-link">My Requests</NuxtLink>
    </header>

    <main class="body">
      <div v-if="loadingExisting" class="card">
        <div class="section-body">
          <p class="ready-note">Loading your request…</p>
        </div>
      </div>

      <div v-else-if="loadError" class="card">
        <div class="section-body">
          <p class="item-error">{{ loadError }}</p>
        </div>
      </div>

      <template v-else>
      <!-- SECTION 1: Personal Information + Request Type -->
      <section class="card">
        <div class="card-toolbar">
          <span class="toolbar-title">1 · Personal Information</span>
        </div>
        <div class="section-body">
          <div class="field-row">
            <div class="field">
              <label for="employeeName">Full Name</label>
              <input id="employeeName" v-model="employeeName" type="text" placeholder="Juan Dela Cruz" :disabled="!!submissionId" />
            </div>
            <div class="field">
              <label for="employeeUsername">Email Address</label>
              <div class="email-compound" :class="{ disabled: !!submissionId }">
                <input id="employeeUsername" v-model="employeeUsername" type="text" placeholder="juan.delacruz" :disabled="!!submissionId" />
                <span class="email-suffix">@carsu.edu.ph</span>
              </div>
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="officeAffiliation">Office Affiliation</label>
              <select id="officeAffiliation" v-model="officeAffiliation" :disabled="!!submissionId">
                <option value="" disabled>Select an office</option>
                <option v-for="opt in OFFICE_AFFILIATION_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
            <div class="field">
              <label for="collegeOfficeUnit">College / Office / Unit</label>
              <input id="collegeOfficeUnit" v-model="collegeOfficeUnit" type="text" placeholder="College of Engineering" :disabled="!!submissionId" />
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="currentPosition">Current Position</label>
              <input id="currentPosition" v-model="currentPosition" type="text" placeholder="Assistant Professor I" :disabled="!!submissionId" />
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="inclusiveDateFrom">Inclusive Dates — From</label>
              <input id="inclusiveDateFrom" v-model="inclusiveDateFrom" type="date" :disabled="!!submissionId" />
            </div>
            <div class="field">
              <label for="inclusiveDateTo">Inclusive Dates — To</label>
              <input id="inclusiveDateTo" v-model="inclusiveDateTo" type="date" :disabled="!!submissionId" />
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="yearsInPosition">Years in Position</label>
              <input id="yearsInPosition" v-model.number="yearsInPosition" type="number" min="0" placeholder="e.g. 3" :disabled="!!submissionId" />
            </div>
            <div class="field">
              <label for="yearsInCsu">Years in CSU</label>
              <input id="yearsInCsu" v-model.number="yearsInCsu" type="number" min="0" placeholder="e.g. 8" :disabled="!!submissionId" />
            </div>
          </div>

          <div class="field">
            <label for="requestType">Request Type</label>
            <select id="requestType" v-model="selectedType" :disabled="!!submissionId || loadingTypes">
              <option value="" disabled>{{ loadingTypes ? 'Loading…' : 'Select a request type' }}</option>
              <option v-for="t in types" :key="t.type" :value="t.type">{{ t.label }}</option>
            </select>
          </div>

          <label v-if="ABROAD_ELIGIBLE.includes(selectedType)" class="abroad-toggle">
            <input type="checkbox" v-model="isAbroad" :disabled="!!submissionId" />
            This is for travel/study abroad (adds CHED IAS Assessment)
          </label>

          <button
            v-if="!submissionId"
            class="begin-btn"
            :disabled="!infoComplete || creating"
            @click="beginChecklist"
          >
            {{ creating ? 'Preparing checklist…' : 'Begin Checklist' }}
          </button>
          <p v-else class="locked-note">✓ Details locked in — see your checklist below.</p>
        </div>
      </section>

      <!-- SECTION 2: Checklist -->
      <section v-if="progress" class="card">
        <div class="card-toolbar">
          <span class="toolbar-title">2 · Required Documents</span>
          <span class="toolbar-hint" :class="{ complete: readyToSubmit || isSubmitted }">
            {{ progress.totalUploaded }}/{{ progress.totalRequired }} uploaded
          </span>
        </div>

        <div class="progress-bar-track">
          <div class="progress-bar-fill" :style="{ width: progress.percentComplete + '%' }" />
        </div>

        <div v-if="isApproved" class="complete-banner approved-banner">
          <p>✓ Request approved{{ progress.submission.approvedAt ? ' on ' + new Date(progress.submission.approvedAt).toLocaleDateString() : '' }}. No further action needed.</p>
          <button class="begin-btn" @click="startNewRequest">Back</button>
        </div>
        <div v-else-if="isSubmitted" class="complete-banner">
          <p>✓ Request submitted{{ progress.submission.submittedAt ? ' on ' + new Date(progress.submission.submittedAt).toLocaleDateString() : '' }} and under HR screening. This request is locked until HR responds.</p>
          <button class="begin-btn" @click="startNewRequest">Back</button>
        </div>
        <div v-else-if="isReturned" class="returned-banner">
          <p><strong>HR sent this request back for correction.</strong> Fix the flagged document(s) below — everything else stays as-is — then resubmit.</p>
          <button class="begin-btn" :disabled="!readyToResubmit || submitting" @click="resubmitRequest">
            {{ submitting ? 'Resubmitting…' : 'Resubmit Request' }}
          </button>
          <p v-if="!readyToResubmit" class="ready-note">Re-upload every flagged document to enable resubmission.</p>
          <p v-if="submitError" class="item-error">{{ submitError }}</p>
        </div>
        <div v-else-if="readyToSubmit" class="submit-row">
          <p class="ready-note">All required documents are uploaded. Review them above, then submit your request.</p>
          <button class="begin-btn" :disabled="submitting" @click="submitRequest">
            {{ submitting ? 'Submitting…' : 'Submit Request' }}
          </button>
          <p v-if="submitError" class="item-error">{{ submitError }}</p>
        </div>

        <div v-for="(group, gi) in groupedItems" :key="gi" class="group">
          <div v-if="group.label" class="group-title">{{ group.label }}</div>

          <table class="item-table">
            <tbody>
              <tr v-for="item in group.items" :key="item.code" class="item-row">
                <td class="col-check">
                  <div class="checkbox" :class="{ checked: !!docFor(item.code) }">
                    <span v-if="docFor(item.code)">✓</span>
                  </div>
                </td>
                <td class="col-body">
                  <span class="item-label">{{ item.label }}</span>
                  <span v-if="item.note" class="item-note">{{ item.note }}</span>
                  <span v-if="docFor(item.code)" class="item-file">
                    {{ docFor(item.code)!.originalFileName }}
                  </span>
                  <span
                    v-if="(isSubmitted || isReturned || isApproved) && docFor(item.code)"
                    class="review-badge"
                    :class="`review-${docFor(item.code)!.reviewStatus}`"
                  >
                    {{ docFor(item.code)!.reviewStatus }}
                  </span>
                  <span v-if="docFor(item.code)?.reviewComment" class="review-comment">
                    HR: “{{ docFor(item.code)!.reviewComment }}”
                  </span>
                  <span v-if="errorByCode[item.code]" class="item-error">{{ errorByCode[item.code] }}</span>
                </td>
                <td class="col-action">
                  <template v-if="itemEditable(item.code)">
                    <button
                      v-if="docFor(item.code)"
                      class="remove-btn"
                      @click="onRemove(item.code)"
                    >
                      Replace
                    </button>
                    <label v-else class="upload-btn" :class="{ busy: uploadingCode === item.code }">
                      {{ uploadingCode === item.code ? 'Uploading…' : 'Upload' }}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        hidden
                        @change="onFileChange(item.code, $event)"
                      />
                    </label>
                  </template>
                  <span v-else class="item-file">Locked</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      </template>
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
.my-requests-link {
  color: #fff;
  background: var(--primary-green);
  padding: 8px 14px;
  border-radius: 6px;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
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
}
.app-title {
  font-size: 15.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
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
.card-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #eee;
  background: #f7faf7;
}
.toolbar-title {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--emerald);
}
.toolbar-hint {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--gray);
}
.toolbar-hint.complete {
  color: var(--primary-green);
}

.section-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.field-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.field {
  flex: 1;
  min-width: 200px;
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
.field input,
.field select {
  border: 1px solid #dcdcdc;
  border-radius: 4px;
  padding: 9px 11px;
  font-size: 14px;
  font-family: inherit;
  background: #fff;
}
.field input:focus,
.field select:focus {
  outline: 2px solid var(--primary-green);
  outline-offset: 1px;
}
.field input:disabled,
.field select:disabled {
  background: #f5f5f5;
  color: #888;
}

.email-compound {
  display: flex;
  align-items: center;
  border: 1px solid #dcdcdc;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}
.email-compound input {
  border: none;
  flex: 1;
  padding: 9px 11px;
  font-size: 14px;
  font-family: inherit;
}
.email-compound input:focus {
  outline: none;
}
.email-compound:focus-within {
  outline: 2px solid var(--primary-green);
  outline-offset: 1px;
}
.email-suffix {
  padding: 9px 11px;
  background: #f5f5f5;
  color: var(--gray);
  font-size: 13.5px;
  border-left: 1px solid #dcdcdc;
  white-space: nowrap;
}
.email-compound.disabled {
  background: #f5f5f5;
}
.email-compound.disabled input {
  background: #f5f5f5;
  color: #888;
}

.abroad-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--gray);
  font-weight: 500;
}
.abroad-toggle input {
  accent-color: var(--primary-green);
}

.begin-btn {
  align-self: flex-start;
  background: var(--primary-green);
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}
.begin-btn:hover:not(:disabled) {
  background: var(--emerald);
}
.begin-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.locked-note {
  margin: 0;
  font-size: 13px;
  color: var(--primary-green);
  font-weight: 600;
}

.progress-bar-track {
  height: 8px;
  background: #eee;
  margin: 16px 20px 0;
  border-radius: 4px;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: var(--gold);
  transition: width 0.3s ease;
}

.complete-banner {
  margin: 16px 20px 0;
  background: #eaf7ea;
  border: 1px solid var(--primary-green);
  color: var(--emerald);
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 13.5px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.complete-banner p {
  margin: 0;
}

.submit-row {
  margin: 16px 20px 0;
  padding: 14px 16px;
  background: #f7faf7;
  border: 1px solid #dcdcdc;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.ready-note {
  margin: 0;
  font-size: 13px;
  color: var(--gray);
}

.group-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--orange);
  padding: 16px 20px 4px;
}

.item-table {
  width: 100%;
  border-collapse: collapse;
}
.item-row {
  border-bottom: 1px solid #f3f3f3;
}
.item-row:last-child {
  border-bottom: none;
}
.item-table td {
  padding: 12px 20px;
  vertical-align: top;
}
.col-check {
  width: 40px;
}
.checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid #ccc;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}
.checkbox.checked {
  background: var(--primary-green);
  border-color: var(--primary-green);
}
.col-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.item-label {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}
.item-note {
  font-size: 12px;
  color: var(--gray);
  font-style: italic;
}
.item-file {
  font-size: 12px;
  color: var(--primary-green);
  font-family: 'IBM Plex Mono', monospace;
}
.item-error {
  font-size: 12px;
  color: #c0392b;
}
.col-action {
  width: 110px;
  text-align: right;
}
.upload-btn,
.remove-btn {
  display: inline-block;
  border: none;
  padding: 7px 14px;
  border-radius: 4px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.upload-btn {
  background: var(--primary-green);
  color: #fff;
}
.upload-btn.busy {
  opacity: 0.6;
}
.remove-btn {
  background: transparent;
  color: var(--gray);
  border: 1px solid #ddd;
}

.returned-banner {
  margin: 16px 20px 0;
  background: #fdecec;
  border: 1px solid #b00020;
  color: #7a0016;
  padding: 14px 16px;
  border-radius: 6px;
  font-size: 13.5px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.returned-banner p {
  margin: 0;
}
.approved-banner {
  background: #eaf7ea;
}
.review-badge {
  display: inline-block;
  width: fit-content;
  padding: 2px 9px;
  border-radius: 12px;
  font-size: 11px;
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
  font-size: 12px;
  color: #b00020;
  font-style: italic;
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