import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware(() => {
  if (!import.meta.client) return
  const { init, isLoggedIn, isUldc, isBoard } = useAuth()
  init()
  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }
  if (!isUldc.value) {
    return navigateTo(isBoard.value ? '/board' : '/my-requests')
  }
})
