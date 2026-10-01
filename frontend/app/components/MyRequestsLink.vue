<script setup lang="ts">
// Shown in every approving official's top bar so they can open their own
// (employee-style) requests, separate from the approvals queue.
</script>

<template>
  <NuxtLink to="/my-requests" class="my-requests-btn">My Requests</NuxtLink>
</template>

<style scoped>
.my-requests-btn {
  background: #009900;
  color: #fff;
  padding: 7px 12px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}
.my-requests-btn:hover {
  background: #007a00;
}
</style>