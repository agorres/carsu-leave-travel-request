<script setup lang="ts">
type ViewMode = 'awaiting' | 'all'

defineProps<{
  mode: ViewMode
  type: string
  pendingCount: number
  totalCount: number
  typeOptions: { value: string; label: string; count: number }[]
}>()

const emit = defineEmits<{
  (e: 'update:mode', value: ViewMode): void
  (e: 'update:type', value: string): void
}>()
</script>

<template>
  <div class="rf">
    <div class="rf-tabs">
      <button type="button" class="rf-tab" :class="{ active: mode === 'awaiting' }" @click="emit('update:mode', 'awaiting')">
        Awaiting my action <span class="rf-badge">{{ pendingCount }}</span>
      </button>
      <button type="button" class="rf-tab" :class="{ active: mode === 'all' }" @click="emit('update:mode', 'all')">
        All requests <span class="rf-badge">{{ totalCount }}</span>
      </button>
    </div>

    <div class="rf-types">
      <span class="rf-label">Request type</span>
      <button
        v-for="o in typeOptions"
        :key="o.value"
        type="button"
        class="rf-chip"
        :class="{ active: type === o.value, empty: o.count === 0 && o.value !== 'all' }"
        @click="emit('update:type', o.value)"
      >
        {{ o.label }} <span class="rf-count">{{ o.count }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.rf {
  background: #fff;
  border: 1px solid #e3e6e3;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rf-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.rf-tab {
  border: 1px solid #cfd6cf;
  background: #fff;
  color: #4d4d4d;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.rf-tab.active {
  background: #009900;
  border-color: #009900;
  color: #fff;
}
.rf-badge {
  display: inline-block;
  margin-left: 6px;
  min-width: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
  font-size: 11.5px;
  text-align: center;
}
.rf-tab.active .rf-badge {
  background: rgba(255, 255, 255, 0.25);
}
.rf-types {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.rf-label {
  font-size: 12px;
  font-weight: 700;
  color: #4d4d4d;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-right: 4px;
}
.rf-chip {
  border: 1px solid #cfd6cf;
  background: #f7f9f7;
  color: #003300;
  padding: 5px 11px;
  border-radius: 6px;
  font-size: 12.5px;
  cursor: pointer;
}
.rf-chip:hover {
  border-color: #009900;
}
.rf-chip.active {
  background: #003300;
  border-color: #003300;
  color: #fff;
}
.rf-chip.empty:not(.active) {
  opacity: 0.5;
}
.rf-count {
  margin-left: 4px;
  font-weight: 700;
}
</style>