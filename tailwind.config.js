/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue'
  ],
  theme: {
    extend: {
      colors: {
        'paddle-teal': {
          DEFAULT: '#3ab6bb',
          light: '#5cc4c9',
          dark: '#2a8a8e',
          50: '#f0fdfe',
          100: '#ccfbfe',
          200: '#99f6fd',
          300: '#60ebfa',
          400: '#22d3ee',
          500: '#3ab6bb',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63'
        },
        'paddle-red': {
          DEFAULT: '#ff272b',
          light: '#ff5659',
          dark: '#cc1f22',
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ff272b',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d'
        }
      }
    }
  },
  plugins: []
};
