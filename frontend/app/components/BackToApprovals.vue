<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { roleHomePath } from '~/utils/role-home'

// Only renders for approving officials; regular employees never see it.
const { user } = useAuth()
const isApprover = computed(() => !!user.value && user.value.role !== 'employee')
const homePath = computed(() => roleHomePath(user.value?.role))
</script>

<template>
  <NuxtLink v-if="isApprover" :to="homePath" class="back-approvals-btn">
    <svg class="back-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    Back to Approvals
  </NuxtLink>
</template>

<style scoped>
/* Matches the other top-bar buttons (outlined, white on the dark green bar) */
.back-approvals-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.45);
  padding: 7px 12px 7px 9px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
}
.back-approvals-btn:hover {
  background: rgba(255, 255, 255, 0.24);
  border-color: #fff;
}
.back-icon {
  flex-shrink: 0;
}
</style>