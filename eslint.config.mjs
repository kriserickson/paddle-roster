// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default withNuxt(
  // Your custom configs here
  {
    rules: {
      // Enforce semicolons
      semi: ['error', 'always'],
      // Ensure semicolon spacing
      'semi-spacing': ['error', { before: false, after: true }],
      'func-style': ['error', 'declaration', { allowArrowFunctions: false }]
    }
  },
  // Allow arrow functions for composables
  {
    files: ['composables/**/*.ts'],
    rules: {
      'func-style': 'off'
    }
  },
  // Prettier integration
  {
    plugins: {
      prettier: prettierPlugin
    },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'error'
    }
  }
);
