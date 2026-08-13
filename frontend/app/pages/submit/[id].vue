<script setup lang="ts">
import { useRoute } from 'vue-router'
import RequestForm from '~/components/RequestForm.vue'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const id = route.params.id as string
</script>

<template>
  <RequestForm :initial-submission-id="id" />
</template>
