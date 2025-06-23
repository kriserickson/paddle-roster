// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },

  // devServer: {
  //   https: {
  //     key: './localhost-key.pem',
  //     cert: './localhost.pem'
  //   }
  // },

  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/test-utils',
    '@nuxt/ui',
    '@pinia/nuxt',
    '@nuxtjs/supabase',
    '@nuxtjs/color-mode'
  ],

  css: ['~/assets/css/main.css'],

  supabase: {
    redirectOptions: {
      login: '/auth/login',
      callback: '/auth/callback',
      exclude: []
    },
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY
  },

  runtimeConfig: {
    public: {
      enableGoogleAuth: process.env.ENABLE_GOOGLE_AUTH === 'true' || false,
      supabase: {
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_ANON_KEY
      }
    }
  },

  typescript: {
    typeCheck: true
  },

  // Add app configuration for default locale
  app: {
    head: {
      htmlAttrs: {
        lang: 'en'
      }
    }
  },

  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
    storageKey: 'color-mode'
  }
});
