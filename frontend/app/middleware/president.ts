import {useAuth} from '~/composables/useAuth'
import {roleHomePath} from '~/utils/role-home'

export default defineNuxtRouteMiddleware(() => {
  if (!import.meta.client) return
  const {init, isLoggedIn, isPresident, user} = useAuth()
  init()
  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }
  if (!isPresident.value) {
    return navigateTo(roleHomePath(user.value?.role))
  }
})