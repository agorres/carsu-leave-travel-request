<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { roleHomePath } from '~/utils/role-home'

// The new-request form now lives at /new-request. The root URL just sends
// people to their own home page (My Requests for employees).
definePageMeta({ middleware: 'auth' })

const { user } = useAuth()

onMounted(() => {
  navigateTo(roleHomePath(user.value?.role), { replace: true })
})
</script>

<template>
  <div />
</template>