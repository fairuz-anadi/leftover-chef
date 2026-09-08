import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // 'android' holds a copy of dist that `cap sync` puts there, plus Gradle's
  // own output. Linting a minified bundle is 285 KB of noise and one very
  // confusing failure.
  globalIgnores(['dist', 'android']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // The service worker runs in a worker scope, not the page: no window, no
    // document, and `self` is the registration itself.
    files: ['public/sw.js'],
    languageOptions: {
      globals: { ...globals.serviceworker, ...globals.browser },
      sourceType: 'script',
    },
  },
])
