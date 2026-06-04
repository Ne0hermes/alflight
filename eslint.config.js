// ============================================================================
//  ESLint flat config — ALFlight
//  ----------------------------------------------------------------------------
//  ⚠️ RÉPARÉ pour ESLint 8.57.1 (version réellement installée).
//  L'ancienne version importait `eslint/config` (defineConfig/globalIgnores)
//  et `reactHooks.configs['recommended-latest']` / `reactRefresh.configs.vite`
//  — APIs introduites par ESLint 9 + plugins v5, donc ABSENTES en 8.57.1 :
//  le lint plantait avec ERR_PACKAGE_PATH_NOT_EXPORTED.
//
//  Cette version :
//   • exporte un tableau flat-config natif (pas de helper `eslint/config`),
//   • déclare les plugins et inline leurs règles (robuste aux versions
//     react-hooks 4.6.x / react-refresh 0.4.x installées),
//   • ne dépend d'aucun preset de plugin susceptible de manquer.
//
//  → Quand le projet passera à ESLint 9, on pourra revenir aux presets flat
//    officiels (reactHooks.configs.flat / reactRefresh.configs.vite).
// ============================================================================

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import unusedImports from 'eslint-plugin-unused-imports'

export default [
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'android/**',
      'ios/**',
      'public/**',
      'eslint.tokens.cjs', // config CJS du garde-fou tokens (linté séparément)
      '**/*.cjs',          // scripts CommonJS (autoTracker.cjs, trackers…)
    ],
  },

  // Règles de base recommandées par ESLint
  js.configs.recommended,

  // Code applicatif React (ESM)
  {
    files: ['**/*.{js,mjs,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        // Globals chargés via <script> CDN dans index.html
        L: 'readonly', // Leaflet (unpkg)
        pdfjsLib: 'readonly', // PDF.js (cdnjs)
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'react': react,
      'unused-imports': unusedImports,
    },
    rules: {
      // react-hooks (inline — équivaut à configs.recommended de la v4.6.x)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // react-refresh (HMR Vite)
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // ⚠️ SÉCURITÉ : marque les identifiants utilisés EN JSX comme « utilisés »
      // pour que unused-imports NE SUPPRIME PAS les composants employés via <X/>.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      // Imports inutilisés : AUTO-supprimables via `eslint --fix` (remplace no-unused-vars).
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['warn', {
        vars: 'all',
        varsIgnorePattern: '^[A-Z_]',
        args: 'after-used',
        argsIgnorePattern: '^_',
      }],
    },
  },
]
