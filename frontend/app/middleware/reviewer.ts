import { useAuth } from '~/composables/useAuth'
import { roleHomePath } from '~/utils/role-home'

// Any approving official (everyone except regular employees).
export default defineNuxtRouteMiddleware(() => {
  if (!import.meta.client) return
  const { init, isLoggedIn, user } = useAuth()
  init()
  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }
  if (!user.value || user.value.role === 'employee') {
    return navigateTo(roleHomePath(user.value?.role))
  }
})