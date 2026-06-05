import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Alias miroir de vite.config.js (résolus en chemins absolus, ESM-natif —
// pas de __dirname). Vitest réutilise ces alias pour que les imports `@core`,
// `@utils`, etc. fonctionnent dans les tests comme dans l'app.
const r = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': r('./src'),
      '@components': r('./src/components'),
      '@core': r('./src/core'),
      '@features': r('./src/features'),
      '@shared': r('./src/shared'),
      '@services': r('./src/services'),
      '@utils': r('./src/utils'),
      '@data': r('./src/data'),
      '@hooks': r('./src/hooks'),
      '@styles': r('./src/styles'),
    },
  },
  test: {
    // Les tests Phase 0 portent sur des fonctions pures / stores Zustand :
    // environnement node suffit. (jsdom sera activé par fichier si besoin UI.)
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
});
