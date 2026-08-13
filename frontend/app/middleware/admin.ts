import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware(() => {
  if (!import.meta.client) return
  const { init, isLoggedIn, isAdmin } = useAuth()
  init()
  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }
  if (!isAdmin.value) {
    return navigateTo('/my-requests')
  }
})
