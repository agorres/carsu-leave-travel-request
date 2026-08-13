import { computed, ref } from 'vue'

export interface AuthUser {
  email: string
  name: string | null
  role: 'employee' | 'admin'
}

const STORAGE_KEY = 'carsu-auth'

// Module-scoped state so every component sharing this composable sees the
// same logged-in user — a lightweight stand-in for a real store.
const token = ref<string | null>(null)
const user = ref<AuthUser | null>(null)
const initialized = ref(false)

function persist() {
  if (!import.meta.client) return
  if (token.value && user.value) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: token.value, user: user.value }))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function useAuth() {
  const config = useRuntimeConfig()
  const base = config.public.apiBase

  // Loads any previously saved session from localStorage. Safe to call
  // repeatedly — only does work once per page load.
  function init() {
    if (initialized.value || !import.meta.client) return
    initialized.value = true
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      token.value = parsed.token
      user.value = parsed.user
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  // Email-only sign-in — no password, no verification link. Typing a
  // valid @carsu.edu.ph address logs you in as that person immediately.
  async function login(email: string): Promise<AuthUser> {
    const result = await $fetch<{ accessToken: string; user: AuthUser }>(`${base}/auth/login`, {
      method: 'POST',
      body: { email },
    })
    token.value = result.accessToken
    user.value = result.user
    persist()
    return result.user
  }

  function logout() {
    token.value = null
    user.value = null
    persist()
  }

  return {
    init,
    token: computed(() => token.value),
    user: computed(() => user.value),
    isLoggedIn: computed(() => !!token.value),
    isAdmin: computed(() => user.value?.role === 'admin'),
    login,
    logout,
  }
}
