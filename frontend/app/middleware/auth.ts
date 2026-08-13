import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware(() => {
  if (!import.meta.client) return
  const { init, isLoggedIn } = useAuth()
  init()
  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }
})
