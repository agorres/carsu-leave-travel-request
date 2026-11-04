<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import { roleHomePath } from '~/utils/role-home'

useHead({
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap' },
  ],
})

const route = useRoute()
const router = useRouter()
const { init, user, logout } = useAuth()

// Auth state is only loaded on the client, so render user-specific parts
// after mount to avoid a hydration mismatch.
const ready = ref(false)
const drawerOpen = ref(false)
const query = ref('')
const searchEl = ref<HTMLInputElement | null>(null)
const accountOpen = ref(false)
const accountEl = ref<HTMLElement | null>(null)

const showShell = computed(() => route.path !== '/login')

const ROLE_LABELS: Record<string, string> = {
  employee: 'Employee',
  uldc_subcommittee: 'ULDC Sub-Committee',
  uldc_committee: 'ULDC Committee',
  board: 'Board',
  admin_council: 'Admin Council',
  president: 'President',
}

const displayName = computed(() => {
  const u = user.value
  if (!u) return ''
  if (u.name) return u.name
  return u.email.split('@')[0]
})
const roleLabel = computed(() => ROLE_LABELS[user.value?.role ?? ''] ?? '')

interface MenuItem { label: string; to: string; icon: string; children?: MenuItem[] }

const ICONS: Record<string, string> = {
  queue: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z',
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  folder: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z',
  add: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z',
  logout: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
  search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  back: 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  chevron: 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
  person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
}

const roleItems = computed<MenuItem[]>(() => {
  switch (user.value?.role) {
    case 'uldc_subcommittee':
    case 'uldc_committee':
    case 'board':
    case 'admin_council':
    case 'president':
      // Same entry for every approving official: Monitoring, with the
      // official's own approvals queue as its sub-item.
      return [
        {
          label: 'Leave & Travel Monitoring',
          to: '/monitoring',
          icon: 'dashboard',
          children: [{ label: 'For Approval', to: roleHomePath(user.value?.role), icon: 'queue' }],
        },
      ]
    default:
      return []
  }
})

const items = computed<MenuItem[]>(() => [
  ...roleItems.value,
  { label: 'My Requests', to: '/my-requests', icon: 'folder' },
])

// Every menu entry including sub-items, for route matching.
const flatItems = computed<MenuItem[]>(() => items.value.flatMap((i) => [i, ...(i.children ?? [])]))

const visibleItems = computed<MenuItem[]>(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.flatMap((i) => {
    if (i.label.toLowerCase().includes(q)) return [i]
    const kids = (i.children ?? []).filter((c) => c.label.toLowerCase().includes(q))
    return kids.length ? [{ ...i, children: kids }] : []
  })
})

// A group with sub-items opens when its parent is clicked, and stays open
// while the person is anywhere inside it.
const openGroups = ref<Record<string, boolean>>({})

function inGroup(item: MenuItem) {
  const path = route.path
  return path === item.to || (item.children ?? []).some((c) => path === c.to || path.startsWith(c.to + '/'))
}

function isOpen(item: MenuItem) {
  return !!item.children?.length && (!!query.value.trim() || !!openGroups.value[item.to])
}

function onParentClick(item: MenuItem) {
  const wasInside = inGroup(item)
  openGroups.value[item.to] = wasInside ? !openGroups.value[item.to] : true
  if (route.path !== item.to) router.push(item.to)
}

watch(
  () => [route.path, ready.value, user.value?.role],
  () => {
    for (const item of items.value) {
      if (item.children?.length && inGroup(item)) openGroups.value[item.to] = true
    }
  },
  { immediate: true },
)

// Highlight only the most specific match, so /uldc-committee/monitoring
// doesn't also light up /uldc-committee.
const activeTo = computed(() => {
  const path = route.path
  const matches = flatItems.value.filter((i) => (i.to === '/' ? path === '/' : path === i.to || path.startsWith(i.to + '/')))
  matches.sort((a, b) => b.to.length - a.to.length)
  return matches[0]?.to ?? ''
})

// Back arrow only on pages that aren't a menu destination (request detail
// pages and the like); menu pages are reached from the sidebar instead.
const showBack = computed(() => ready.value && !!user.value && !flatItems.value.some((i) => i.to === route.path))

function goBack() {
  if (window.history.state?.back) router.back()
  else router.push(roleHomePath(user.value?.role))
}

function signOut() {
  accountOpen.value = false
  logout()
  router.push('/login')
}

function onDocClick(e: MouseEvent) {
  if (accountOpen.value && accountEl.value && !accountEl.value.contains(e.target as Node)) {
    accountOpen.value = false
  }
}

function onKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    drawerOpen.value = true
    searchEl.value?.focus()
  } else if (e.key === 'Escape') {
    drawerOpen.value = false
    accountOpen.value = false
  }
}

onMounted(() => {
  init()
  ready.value = true
  window.addEventListener('keydown', onKey)
  document.addEventListener('click', onDocClick)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('click', onDocClick)
})
watch(() => route.fullPath, () => { drawerOpen.value = false; accountOpen.value = false })
</script>

<template>
  <slot v-if="!showShell" />

  <div v-else class="app-frame" :class="{ 'has-back': showBack }">
    <div class="mobile-bar">
      <button class="icon-btn" aria-label="Open menu" @click="drawerOpen = true">
        <svg viewBox="0 0 24 24" width="22" height="22"><path :d="ICONS.menu" fill="currentColor" /></svg>
      </button>
      <span class="mobile-title">CARSU Leave &amp; Travel</span>
    </div>

    <div v-if="drawerOpen" class="scrim" @click="drawerOpen = false"></div>

    <aside class="sidebar" :class="{ open: drawerOpen }" aria-label="Main navigation">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path d="M8 5l8 7-8 7" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-name">Caraga State University</span>
          <span class="brand-sub">Leave &amp; Travel Requirements</span>
        </div>
      </div>

      <div class="sidebar-scroll">
        <div v-if="ready && user" class="profile">
          <svg class="avatar" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="50" fill="#efefef" />
            <circle cx="50" cy="38" r="17" fill="#111" />
            <path d="M18 88c2-20 16-30 32-30s30 10 32 30c-9 8-20 12-32 12S27 96 18 88z" fill="#111" />
          </svg>
          <span class="profile-name">{{ displayName }}</span>
          <span class="profile-role">{{ roleLabel }}</span>
        </div>

        <label class="search">
          <input ref="searchEl" v-model="query" type="search" placeholder="Search menu... (Ctrl+K)" />
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path :d="ICONS.search" fill="currentColor" /></svg>
        </label>

        <div class="menu-heading">Menu</div>

        <nav v-if="ready">
          <template v-for="item in visibleItems" :key="item.to">
            <a
              v-if="item.children?.length"
              :href="item.to"
              class="menu-item"
              :class="{ active: item.to === activeTo }"
              :aria-expanded="isOpen(item)"
              @click.prevent="onParentClick(item)"
            >
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path :d="ICONS[item.icon]" fill="currentColor" /></svg>
              <span>{{ item.label }}</span>
              <svg class="chevron" :class="{ open: isOpen(item) }" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path :d="ICONS.chevron" fill="currentColor" /></svg>
            </a>
            <NuxtLink
              v-else
              :to="item.to"
              class="menu-item"
              :class="{ active: item.to === activeTo }"
            >
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path :d="ICONS[item.icon]" fill="currentColor" /></svg>
              <span>{{ item.label }}</span>
            </NuxtLink>

            <div v-if="isOpen(item)" class="submenu">
              <NuxtLink
                v-for="child in item.children"
                :key="child.to"
                :to="child.to"
                class="menu-item sub"
                :class="{ active: child.to === activeTo }"
              >
                <span>{{ child.label }}</span>
              </NuxtLink>
            </div>
          </template>
          <p v-if="visibleItems.length === 0" class="no-match">No menu items match “{{ query }}”.</p>

          <button class="menu-item signout" @click="signOut">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path :d="ICONS.logout" fill="currentColor" /></svg>
            <span>Log out</span>
          </button>
        </nav>
      </div>
    </aside>

    <div class="app-content">
      <button v-if="showBack" class="back-btn" aria-label="Go back" @click="goBack">
        <svg viewBox="0 0 24 24" width="26" height="26"><path :d="ICONS.back" fill="currentColor" /></svg>
      </button>

      <div v-if="ready && user" ref="accountEl" class="account">
        <button
          class="account-btn"
          aria-label="Account"
          :aria-expanded="accountOpen"
          @click="accountOpen = !accountOpen"
        >
          <svg viewBox="0 0 24 24" width="24" height="24"><path :d="ICONS.person" fill="currentColor" /></svg>
        </button>
        <div v-if="accountOpen" class="account-pop" role="menu">
          <span class="pop-name">{{ displayName }}</span>
          <span class="pop-email">{{ user.email }}</span>
          <span class="pop-role">{{ roleLabel }}</span>
          <button class="pop-logout" role="menuitem" @click="signOut">
            <svg viewBox="0 0 24 24" width="20" height="20"><path :d="ICONS.logout" fill="currentColor" /></svg>
            Log out
          </button>
        </div>
      </div>

      <slot />
    </div>

    <footer class="app-footer">
      <span>© 2026 - CARSU Leave &amp; Travel Requirements</span>
      <span>Caraga State University</span>
    </footer>
  </div>
</template>

<style>
/* Unscoped on purpose: gives every page's existing green top bar the same
   taller, flatter look as the reference, without editing each page. */
.app-content :is(.shell, .admin-shell) > :is(.topbar, .admin-topbar) {
  min-height: 72px;
  padding-top: 0;
  padding-bottom: 0;
}
/* The layout has its own footer bar, so hide the ones pages draw themselves. */
.app-content :is(.shell, .admin-shell) > footer {
  display: none;
}
/* The sidebar and the round back button replace each detail page's own
   "All Requests" link. */
.app-content .admin-topbar-right .link-back {
  display: none;
}
/* Bigger cards on the approving pages. */
.app-content .admin-shell > .admin-body {
  max-width: 1500px;
  padding-left: 32px;
  padding-right: 32px;
}
.app-content .admin-shell > .admin-body .admin-card {
  padding: 28px;
}
/* View File and Download sit side by side with a gap. */
.app-content .view-link {
  display: inline-flex;
  white-space: nowrap;
}
.app-content .view-link + .view-link {
  margin-left: 12px;
}
.app-content div:has(> .view-link + .view-link) {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 12px;
}
.app-content div:has(> .view-link + .view-link) > .view-link + .view-link {
  margin-left: 0;
}
/* The account menu (top right) replaces each page's own email + log out. */
.app-content :is(.admin-topbar-right, .topbar-right) {
  padding-right: 56px;
}
.app-content :is(.session-email, .logout-btn) {
  display: none;
}
/* Room for the round back button on detail pages. */
.has-back .app-content :is(.admin-title, .topbar-left) {
  padding-left: 52px;
}
/* The circle icon in each page's own top bar is redundant: the sidebar
   already carries the app's circle icon. */
.app-content .app-icon {
  display: none;
}
</style>

<style scoped>
.app-frame {
  --sidebar-w: 280px;
  --footer-h: 40px;
  --emerald: #003300;
  --accent: #f9a825;
  font-family: 'Roboto', system-ui, -apple-system, 'Segoe UI', sans-serif;
  min-height: 100vh;
}

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: var(--footer-h);
  width: var(--sidebar-w);
  background: #fff;
  border-right: 1px solid #e3e3e3;
  display: flex;
  flex-direction: column;
  z-index: 30;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #ececec;
  height: 72px;
  flex-shrink: 0;
}
.brand-mark {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--emerald);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.brand-text { display: flex; flex-direction: column; min-width: 0; }
.brand-name { font-size: 15px; font-weight: 700; color: #1a1a1a; line-height: 1.2; }
.brand-sub { font-size: 11.5px; color: #5b5b5b; line-height: 1.3; }

.sidebar-scroll { flex: 1; overflow-y: auto; padding: 18px 10px 24px; }

.profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0 10px 18px;
  text-align: center;
}
.avatar { width: 96px; height: 96px; margin-bottom: 8px; }
.profile-name {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--emerald);
  text-decoration: underline;
  text-transform: uppercase;
  word-break: break-word;
}
.profile-role { font-size: 12px; color: #5b5b5b; }

.search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 10px 18px;
  padding: 0 12px;
  height: 46px;
  border: 1px solid #c9c9c9;
  border-radius: 6px;
  color: #666;
}
.search:focus-within { border-color: var(--emerald); box-shadow: 0 0 0 2px rgba(0, 51, 0, 0.15); }
.search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  color: #1a1a1a;
}

.menu-heading { padding: 0 10px 6px; font-size: 13px; font-weight: 700; color: #1a1a1a; }

.menu-item {
  display: flex;
  align-items: center;
  gap: 24px;
  width: 100%;
  padding: 0 16px;
  height: 48px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #1f1f1f;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  text-align: left;
  cursor: pointer;
}
.menu-item svg { color: #5b5b5b; flex-shrink: 0; }
.menu-item:hover { background: #f3f3f3; }
.menu-item.active { background: #e8e8e8; }
.chevron { margin-left: auto; transition: transform 0.15s ease; }
.chevron.open { transform: rotate(180deg); }
.submenu { display: flex; flex-direction: column; margin: 2px 0 4px; }
.menu-item.sub { height: 42px; padding-left: 64px; font-weight: 400; }
.menu-item.active svg { color: var(--emerald); }
.menu-item:focus-visible { outline: 2px solid var(--emerald); outline-offset: -2px; }
.signout { margin-top: 8px; }
.no-match { margin: 8px 16px; font-size: 13px; color: #666; }

.app-content {
  position: relative;
  margin-left: var(--sidebar-w);
  min-height: 100vh;
  padding-bottom: var(--footer-h);
}

.app-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--footer-h);
  background: var(--accent);
  color: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  font-size: 14px;
  z-index: 40;
}

.back-btn {
  position: absolute;
  top: 16px;
  left: 28px;
  z-index: 5;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: #fff;
  color: var(--emerald);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.back-btn:hover { background: #e6efe6; }
.back-btn:focus-visible,
.account-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

.account { position: absolute; top: 16px; right: 24px; z-index: 6; }
.account-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: transparent;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.account-btn:hover { background: rgba(255, 255, 255, 0.15); }
.account-pop {
  position: absolute;
  top: 48px;
  right: 0;
  min-width: 240px;
  background: #fff;
  color: #1a1a1a;
  border: 1px solid #dcdcdc;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  padding: 14px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pop-name { font-weight: 700; font-size: 14px; color: var(--emerald); word-break: break-word; }
.pop-email { font-size: 12.5px; color: #4d4d4d; word-break: break-all; }
.pop-role { font-size: 12px; color: #6b6b6b; margin-bottom: 8px; }
.pop-logout {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 -8px;
  padding: 10px 8px;
  border: none;
  border-top: 1px solid #ececec;
  background: transparent;
  font: inherit;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  border-radius: 0 0 6px 6px;
}
.pop-logout:hover { background: #f3f3f3; }

.mobile-bar { display: none; }
.scrim { display: none; }

@media (max-width: 900px) {
  .mobile-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 52px;
    padding: 0 12px;
    background: #fff;
    border-bottom: 1px solid #e3e3e3;
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .mobile-title { font-weight: 700; color: var(--emerald); font-size: 15px; }
  .icon-btn {
    border: none;
    background: transparent;
    color: #1a1a1a;
    width: 40px;
    height: 40px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .icon-btn:hover { background: #f0f0f0; }
  .sidebar { transform: translateX(-100%); transition: transform 0.2s ease; box-shadow: none; }
  .sidebar.open { transform: translateX(0); box-shadow: 0 0 24px rgba(0, 0, 0, 0.25); }
  .scrim { display: block; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); z-index: 25; }
  .app-content { margin-left: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar { transition: none; }
  .chevron { transition: none; }
}
</style>