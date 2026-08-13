<script setup lang="ts">
import RequestForm from '~/components/RequestForm.vue'

definePageMeta({ middleware: 'auth' })
</script>

<template>
  <RequestForm />
</template>
