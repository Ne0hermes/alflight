import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      // DÉSACTIVER PWA en mode développement pour éviter le cache
      disable: mode === 'development',
      registerType: 'autoUpdate',
      includeAssets: ['favicon-16.png', 'favicon-32.png', 'icon-192.png', 'icon-512.png'],
      manifestFilename: 'manifest.json',  // Forcer .json au lieu de .webmanifest
      manifest: {
        name: 'ALFlight - Assistant de Vol',
        short_name: 'ALFlight',
        description: 'Application mobile de gestion de vol pour pilotes privés',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        // 🎨 Couleurs PWA alignees sur la charte editoriale ALFlight v1
        //    --app-bg (#0A0A0A noir profond) + accent orange #f26921.
        //    Le theme_color colore la barre status mobile (Android) et la
        //    barre de titre PWA installee. background_color est affiche
        //    pendant le chargement initial de l app avant que React monte.
        theme_color: '#0A0A0A',
        background_color: '#0A0A0A',
        categories: ['navigation', 'productivity', 'utilities'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Forcer le rechargement automatique des mises à jour
        skipWaiting: true,
        clientsClaim: true,
        // Nettoyer les anciens caches quand une nouvelle version est déployée
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Exclure les fichiers volumineux du précaching
        globIgnores: ['**/*.geojson', '**/data/**/*.geojson', '**/data/**/*.xml', '**/*.pdf'],
        // Augmenter la limite pour les autres assets
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        // Ne pas cacher les fichiers data en navigateFallback
        navigateFallbackDenylist: [/^\/data\//],
        runtimeCaching: [
          {
            // Ne PAS cacher les fichiers AIXM XML (trop volumineux ~40MB+)
            urlPattern: /\/data\/AIXM.*\.xml$/,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 an
              }
            }
          },
          {
            // Cache les fichiers GeoJSON avec stratégie NetworkFirst
            urlPattern: /\/data\/geojson\/.*\.geojson$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'geojson-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 jours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      // Options de développement
      devOptions: {
        enabled: false, // Désactiver complètement en dev
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@core': path.resolve(__dirname, './src/core'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@data': path.resolve(__dirname, './src/data'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@context': path.resolve(__dirname, './src/old/context'),
      '@modules': path.resolve(__dirname, './src/old/modules')
    }
  },
  server: {
    // Port aligné avec le script `npm run dev` (vite --port 4000).
    // Le HMR doit utiliser le MÊME port que le serveur HTTP sinon le
    // WebSocket de hot-reload ne se connecte jamais et les modifs ne
    // sont jamais poussées au navigateur (cache éternel côté client).
    port: 4000,
    host: '0.0.0.0',
    strictPort: false,
    hmr: {
      clientPort: 4000,
      port: 4000,
      protocol: 'ws',
      host: 'localhost'
    },
    // ─── Watcher : exclure les gros fichiers / dossiers non-source ───
    // Sans cette config, Vite watchait src/data/*.xml (~70 MB combinés)
    // ce qui saturait les file handles Windows et causait des crashes
    // récurrents (HMR figé, serveur qui ne répond plus, processus zombies).
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/backups/**',
        '**/src/data/**',           // XML AIXM/SIA volumineux (43 + 27 MB)
        '**/src/data/old/**',
        '**/public/data/old/**',
        '**/public/data/**/*.xml',
        '**/public/data/**/*.geojson',
        '**/*.log',
        '**/.vite/**',
        '**/coverage/**',
        '**/.vite-restart.log'
      ]
    },
    // DÉSACTIVÉ: Ces headers bloquent les requêtes Supabase
    // headers: {
    //   'Cross-Origin-Embedder-Policy': 'require-corp',
    //   'Cross-Origin-Opener-Policy': 'same-origin'
    // },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4001/',
        changeOrigin: true,
      },
      '/api/vac-proxy': {
        target: 'https://www.sia.aviation-civile.gouv.fr',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost');
          const targetPath = url.searchParams.get('url');
          return targetPath.replace('https://www.sia.aviation-civile.gouv.fr', '');
        },
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Ajouter des headers si nécessaire pour contourner CORS
            proxyReq.setHeader('Origin', 'https://www.sia.aviation-civile.gouv.fr');
            proxyReq.setHeader('Referer', 'https://www.sia.aviation-civile.gouv.fr/');
          });
        }
      }
    }
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  worker: {
    format: 'es'
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          pdf: ['pdfjs-dist']
        }
      }
    },
    chunkSizeWarningLimit: 1000 // Augmenter la limite pour les PDFs
  }
}));