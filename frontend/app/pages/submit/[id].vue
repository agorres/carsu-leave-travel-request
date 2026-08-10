<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useChecklist, type SubmissionProgress } from '~/composables/useChecklist'

const route = useRoute()
const submissionId = route.params.id as string
const { getProgress, uploadDocument, removeDocument } = useChecklist()

const progress = ref<SubmissionProgress | null>(null)
const uploadingCode = ref<string | null>(null)
const errorByCode = ref<Record<string, string>>({})

async function refresh() {
  progress.value = await getProgress(submissionId)
}

onMounted(refresh)

const isComplete = computed(() => progress.value?.submission.status === 'complete')

async function onFileChange(itemCode: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploadingCode.value = itemCode
  errorByCode.value = { ...errorByCode.value, [itemCode]: '' }
  try {
    await uploadDocument(submissionId, itemCode, file)
    await refresh()
  } catch (e: any) {
    errorByCode.value = { ...errorByCode.value, [itemCode]: e?.data?.message || 'Upload failed. Try again.' }
  } finally {
    uploadingCode.value = null
    input.value = ''
  }
}

async function onRemove(itemCode: string) {
  await removeDocument(submissionId, itemCode)
  await refresh()
}

function docFor(itemCode: string) {
  return progress.value?.submission.documents.find((d) => d.itemCode === itemCode)
}

// Group items: base items first, then each conditional group under its own heading
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
  <div class="page" v-if="progress">
    <header class="masthead">
      <div class="masthead-text">
        <p class="eyebrow">Caraga State University · HRMS</p>
        <h1>Leave &amp; Travel Requirements</h1>
      </div>
      <div class="progress-badge" :class="{ complete: isComplete }">
        <span class="count">{{ progress.totalUploaded }}/{{ progress.totalRequired }}</span>
        <span class="label">submitted</span>
      </div>
    </header>

    <div class="progress-bar-track">
      <div class="progress-bar-fill" :style="{ width: progress.percentComplete + '%' }" />
    </div>

    <div v-if="isComplete" class="stamp" aria-live="polite">
      <div class="stamp-ring">
        <span>REQUIREMENTS<br />COMPLETE</span>
      </div>
    </div>

    <section class="ledger">
      <div v-for="(group, gi) in groupedItems" :key="gi" class="group">
        <h2 v-if="group.label" class="group-title">{{ group.label }}</h2>

        <ul class="item-list">
          <li v-for="item in group.items" :key="item.code" class="item-row">
            <div class="checkbox" :class="{ checked: !!docFor(item.code) }">
              <span v-if="docFor(item.code)">✓</span>
            </div>

            <div class="item-body">
              <span class="item-label">{{ item.label }}</span>
              <span v-if="item.note" class="item-note">{{ item.note }}</span>
              <span v-if="docFor(item.code)" class="item-file">
                {{ docFor(item.code)!.originalFileName }}
              </span>
              <span v-if="errorByCode[item.code]" class="item-error">{{ errorByCode[item.code] }}</span>
            </div>

            <div class="item-action">
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
              <input
                v-if="docFor(item.code)"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                hidden
                :id="`replace-${item.code}`"
                @change="onFileChange(item.code, $event)"
              />
            </div>
          </li>
        </ul>
      </div>
    </section>
  </div>
  <div v-else class="loading">Loading checklist…</div>
</template>

<style scoped>
.page {
  --ink: #1b2a4a;
  --ink-soft: #3c4a68;
  --paper: #f6f4ee;
  --paper-line: #dcd6c6;
  --brass: #a9803f;
  --brass-deep: #7c5c2a;
  --green: #2f6d4f;
  min-height: 100vh;
  background: var(--ink);
  font-family: 'Inter', system-ui, sans-serif;
  padding: 48px 24px 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.loading {
  color: #c7cede;
  padding: 60px;
  text-align: center;
}

.masthead {
  max-width: 760px;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
}
.eyebrow {
  color: var(--brass);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 12px;
  margin: 0 0 6px;
}
h1 {
  font-family: 'Georgia', serif;
  color: #f6f4ee;
  font-size: 26px;
  margin: 0;
  font-weight: 600;
}
.progress-badge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  color: #f6f4ee;
}
.progress-badge .count {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 20px;
  font-weight: 600;
}
.progress-badge .label {
  font-size: 11px;
  color: #9aa5c1;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.progress-badge.complete .count {
  color: #7fd4a8;
}

.progress-bar-track {
  max-width: 760px;
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 24px;
}
.progress-bar-fill {
  height: 100%;
  background: var(--brass);
  transition: width 0.3s ease;
}

.stamp {
  max-width: 760px;
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}
.stamp-ring {
  border: 3px solid var(--green);
  color: var(--green);
  border-radius: 50%;
  width: 110px;
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-family: 'Georgia', serif;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.06em;
  transform: rotate(-8deg);
  margin: 4px 0 20px;
}

.ledger {
  max-width: 760px;
  width: 100%;
  background: var(--paper);
  border-radius: 4px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
  padding: 8px 0 16px;
}
.group-title {
  font-family: 'Georgia', serif;
  color: var(--brass-deep);
  font-size: 14px;
  margin: 20px 24px 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.item-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.item-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--paper-line);
}
.item-row:last-child {
  border-bottom: none;
}
.checkbox {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: 2px solid var(--ink-soft);
  border-radius: 3px;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}
.checkbox.checked {
  background: var(--green);
  border-color: var(--green);
}
.item-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.item-label {
  color: var(--ink);
  font-size: 14.5px;
  font-weight: 600;
}
.item-note {
  color: var(--ink-soft);
  font-size: 12.5px;
  font-style: italic;
}
.item-file {
  color: var(--green);
  font-size: 12.5px;
  font-family: 'IBM Plex Mono', monospace;
}
.item-error {
  color: #b3423a;
  font-size: 12.5px;
}
.item-action {
  flex-shrink: 0;
}
.upload-btn,
.remove-btn {
  display: inline-block;
  background: var(--ink);
  color: #f6f4ee;
  border: none;
  padding: 8px 14px;
  border-radius: 3px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.upload-btn.busy {
  opacity: 0.6;
}
.remove-btn {
  background: transparent;
  color: var(--ink-soft);
  border: 1px solid var(--paper-line);
}
</style>