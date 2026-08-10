export default defineNuxtConfig({
  compatibilityDate: '2026-08-07',
  css: ['~/assets/css/main.css'],
  devServer: {
    port: 3001,
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3000',
    },
  },
})