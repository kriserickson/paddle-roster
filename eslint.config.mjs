// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt(
  // Your custom configs here
  {
    rules: {
      // Enforce semicolons
      'semi': ['error', 'always'],
      // Ensure semicolon spacing
      'semi-spacing': ['error', { before: false, after: true }]
    }
  }
);
