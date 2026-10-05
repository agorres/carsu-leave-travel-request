import { computed, ref, type Ref } from 'vue'

export type ViewMode = 'awaiting' | 'all'

export const REQUEST_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'study_leave', label: 'Study Leave' },
  { value: 'study_leave_extension', label: 'Study Leave Extension' },
  { value: 'sabbatical_leave', label: 'Sabbatical Leave' },
  { value: 'local_travel', label: 'Local Travel' },
  { value: 'foreign_travel', label: 'Foreign Travel' },
  { value: 'personal_travel', label: 'Personal Travel' },
]

/**
 * Shared filtering for the approving officials' request lists.
 * - mode "awaiting": only requests whose status is waiting for this official
 * - mode "all": everything that reached (or passed) this official
 * - type: narrows either view down to one request type
 */
export function useRequestFilters<T extends { status: string; requestType: string }>(
  submissions: Ref<T[]>,
  awaitingStatuses: string[],
) {
  const mode = ref<ViewMode>('awaiting')
  const typeFilter = ref<string>('all')

  const base = computed(() =>
    mode.value === 'awaiting'
      ? submissions.value.filter((s) => awaitingStatuses.includes(s.status))
      : submissions.value,
  )

  const pendingCount = computed(
    () => submissions.value.filter((s) => awaitingStatuses.includes(s.status)).length,
  )

  const typeOptions = computed(() => [
    { value: 'all', label: 'All types', count: base.value.length },
    ...REQUEST_TYPE_OPTIONS.map((o) => ({
      ...o,
      count: base.value.filter((s) => s.requestType === o.value).length,
    })),
  ])

  const filtered = computed(() =>
    typeFilter.value === 'all'
      ? base.value
      : base.value.filter((s) => s.requestType === typeFilter.value),
  )

  return { mode, typeFilter, filtered, pendingCount, typeOptions }
}