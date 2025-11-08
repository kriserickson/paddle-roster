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
    // Disable type checking during dev to speed up startup. Run full type checks in CI or manually.
    typeCheck: false
  },

  // Vite hints to reduce file-watcher scanning and pre-bundle known heavy deps
  vite: {
    server: {
      watch: {
        // Ignore large folders that don't contain source files to speed up chokidar scanning on Windows
        ignored: [
          '**/coverage/**',
          '**/playwright-report/**',
          '**/test-results/**',
          '**/node_modules/**',
          '**/tests/**'
        ]
      }
    },
    optimizeDeps: {
      // Pre-bundle deps that were shown re-optimizing in logs to avoid a second slow optimization pass
      include: ['zod', 'jspdf', 'html2canvas']
    }
  },

  // Add app configuration for default locale
  app: {
    head: {
      htmlAttrs: {
        lang: 'en'
      },
      link: [
        {
          rel: 'icon',
          type: 'image/x-icon',
          href: '/32x32.png'
        },
        {
          rel: 'apple-touch-icon',
          sizes: '180x180',
          href: '/apple-touch-icon.png'
        }
      ]
    }
  },

  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
    storageKey: 'color-mode'
  }
});
