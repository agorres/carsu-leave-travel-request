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
  <NuxtLink v-if="isApprover" :to="homePath" class="back-approvals-btn">Back to Approvals</NuxtLink>
</template>

<style scoped>
.back-approvals-btn {
  background: #f9dc07;
  color: #003300;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}
.back-approvals-btn:hover {
  filter: brightness(0.95);
}
</style>