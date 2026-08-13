<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '~/composables/useAuth'

const { login, isLoggedIn, isAdmin } = useAuth()

const email = ref('')
const submitting = ref(false)
const error = ref('')

onMounted(() => {
  if (isLoggedIn.value) {
    navigateTo(isAdmin.value ? '/admin' : '/my-requests')
  }
})

async function signIn() {
  const value = email.value.trim()
  if (!value) return
  submitting.value = true
  error.value = ''
  try {
    const user = await login(value)
    navigateTo(user.role === 'admin' ? '/admin' : '/my-requests', { replace: true })
  } catch (e: any) {
    error.value = e?.data?.message || 'Could not sign in. Check your email and try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="topbar-left">
        <div class="app-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path d="M8 5l8 7-8 7" stroke="#003300" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="app-title">CARSU · Leave &amp; Travel Requirements</span>
      </div>
    </header>

    <main class="body">
      <section class="card">
        <div class="section-body">
          <h1 class="title">Sign in</h1>
          <p class="subtitle">Enter your CARSU email to continue.</p>

          <div class="field-row">
            <div class="field">
              <label for="email">Email Address</label>
              <input
                id="email"
                v-model="email"
                type="email"
                placeholder="juan.delacruz@carsu.edu.ph"
                @keyup.enter="signIn"
              />
            </div>
            <button class="primary-btn" :disabled="!email.trim() || submitting" @click="signIn">
              {{ submitting ? 'Signing in…' : 'Sign In' }}
            </button>
          </div>

          <p v-if="error" class="item-error">{{ error }}</p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.shell {
  --primary-green: #009900;
  --emerald: #003300;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  font-family: 'Inter', system-ui, sans-serif;
}
.topbar {
  background: var(--emerald);
  color: #fff;
  display: flex;
  align-items: center;
  padding: 14px 28px;
}
.topbar-left { display: flex; align-items: center; gap: 12px; }
.app-icon {
  width: 32px; height: 32px; border-radius: 50%;
  background: #fff; display: flex; align-items: center; justify-content: center;
}
.app-title { font-size: 15.5px; font-weight: 600; letter-spacing: 0.01em; }

.body {
  flex: 1;
  padding: 48px 32px;
  display: flex;
  justify-content: center;
}
.card {
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e5e5e5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  max-width: 420px;
  width: 100%;
  height: fit-content;
}
.section-body { padding: 28px; display: flex; flex-direction: column; gap: 14px; }
.title { margin: 0; font-size: 19px; color: var(--emerald); }
.subtitle { margin: 0; font-size: 13.5px; color: #4d4d4d; line-height: 1.5; }
.field-row { display: flex; flex-direction: column; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
  color: #4d4d4d; font-weight: 600;
}
.field input {
  border: 1px solid #dcdcdc; border-radius: 4px; padding: 9px 11px;
  font-size: 14px; font-family: inherit;
}
.field input:focus { outline: 2px solid var(--primary-green); outline-offset: 1px; }
.primary-btn {
  background: var(--primary-green); color: #fff; border: none;
  padding: 10px 18px; border-radius: 4px; font-size: 13.5px; font-weight: 600; cursor: pointer;
}
.primary-btn:hover:not(:disabled) { background: var(--emerald); }
.primary-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.item-error { margin: 0; font-size: 12.5px; color: #c0392b; }
</style>
