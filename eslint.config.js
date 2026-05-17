import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'dist/**',
    'dist-ssr',
    'dist-ssr/**',
    'node_modules',
    'node_modules/**',
    'server/node_modules',
    'server/node_modules/**',
    '.tmp-visual-audit',
    '.tmp-visual-audit/**',
    'output',
    'output/**',
    'knowledge-extractor',
    'knowledge-extractor/**',
    'knowledge-pipeline/output',
    'knowledge-pipeline/output/**',
    'knowledge-pipeline/test_output.txt',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/store/*Context.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
