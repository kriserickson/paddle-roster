import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.spec.ts']
  },
  resolve: {
    alias: {
      '~/': resolve(__dirname, './'),
      '@/': resolve(__dirname, './'),
    }
  }
})
