import type { NuxtConfig } from 'nuxt/schema';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default {
  // Add app configuration for default locale
  app: {
    head: {
      htmlAttrs: {
        lang: 'en'
      },
      link: [
        {
          href: '/32x32.png',
          rel: 'icon',
          type: 'image/x-icon'
        },
        {
          href: '/apple-touch-icon.png',
          rel: 'apple-touch-icon',
          sizes: '180x180'
        }
      ],
      title: 'Paddle Roster'
    }
  },
  colorMode: {
    classSuffix: '',
    fallback: 'light',
    preference: 'system',
    storageKey: 'color-mode'
  },
  compatibilityDate: '2025-05-15',
  css: ['~/assets/css/main.css'],
  devtools: {
    enabled: true
  },
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
  runtimeConfig: {
    public: {
      enableGoogleAuth: process.env.ENABLE_GOOGLE_AUTH === 'true' || false,
      supabase: {
        key: process.env.SUPABASE_ANON_KEY,
        url: process.env.SUPABASE_URL
      }
    }
  },
  supabase: {
    key: process.env.SUPABASE_ANON_KEY,
    redirectOptions: {
      callback: '/auth/callback',
      exclude: [],
      login: '/auth/login'
    },
    url: process.env.SUPABASE_URL
  },
  typescript: {
    // Disable type checking during dev to speed up startup. Run full type checks in CI or manually.
    typeCheck: false
  },
  // Vite hints to reduce file-watcher scanning and pre-bundle known heavy deps
  vite: {
    // Remove warnings from Nuxt's rollup build about broken source maps and invalid annotations in VueUse
    // In the future this hopefully will not be needed as Nuxt and VueUse improve their build processes, but for now it helps reduce noise in the console.
    build: {
      rollupOptions: {
        onwarn(warning, defaultHandler) {
          const isNuxtPreloadSourcemapWarning =
            warning.code === 'SOURCEMAP_BROKEN' && warning.plugin === 'nuxt:module-preload-polyfill';
          const isVueUsePureAnnotationWarning =
            warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('/@vueuse/core/dist/index.js');
          if (isNuxtPreloadSourcemapWarning || isVueUsePureAnnotationWarning) {
            return;
          }
          defaultHandler(warning);
        }
      }
    },
    optimizeDeps: {
      // Pre-bundle deps that were shown re-optimizing in logs to avoid a second slow optimization pass
      include: ['html2canvas', 'jspdf', 'zod']
    },
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
    }
  }
} satisfies NuxtConfig;
